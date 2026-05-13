export interface Env {
  DB: D1Database;
}

import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

export enum DeviceCommand {
  SetPhase = "set_phase",
  SetMode = "set_mode",
  ManualRun = "manual_run",
  Stop = "stop",
  Reboot = "reboot",
}

export type Phase = "germination" | "nursery";
export type Mode = "auto" | "manual";

export interface CommandPayload {
  [DeviceCommand.SetPhase]: { phase: Phase };
  [DeviceCommand.SetMode]: { mode: Mode };
  [DeviceCommand.ManualRun]: { light?: number; fan?: number; mist?: number };
  [DeviceCommand.Stop]: Record<string, never>;
  [DeviceCommand.Reboot]: Record<string, never>;
}

export type CommandEntry<C extends DeviceCommand = DeviceCommand> = {
  cmd: C;
  params: CommandPayload[C];
};

// Helper for SQLite "Booleans" (0/1) or actual booleans
const sqliteBool = z
  .union([z.literal(0), z.literal(1), z.boolean()])
  .transform((v) => v === 1 || v === true);

const SeedlingDataSchema = z.object({
  // Sensor readings
  luxLvl: z.number().default(-1),
  tempLvl: z.number().default(-1),
  moistureLvl: z.number().default(-1),
  waterLvl: z.string().default("Unknown"),
  waterRawADC: z.number().optional(),

  // Actuator states
  isLightOn: sqliteBool,
  isFanOn: sqliteBool,
  isFan2On: sqliteBool.optional(),
  isMistingOn: sqliteBool,
  fanBoost: sqliteBool.optional(),
  fanCyclePos: z.number().int().optional(),

  // Mode / phase
  mode: z.enum(["auto", "manual"]),
  phase: z.enum(["germination", "nursery"]),
  nurseryDay: z.number().int().optional(),

  // Connectivity
  wifiOK: sqliteBool.optional(),
  ntpOK: sqliteBool.optional(),

  // Error / alarm flags
  shtError: sqliteBool.optional(),
  luxError: sqliteBool.optional(),
  germHumidAlarm: sqliteBool.optional(),
  waterLvlAlarm: sqliteBool.optional(),

  // Germination countdown
  germRemainingSeconds: z.number().optional(),
});

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.get("/api/seedling/latest", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM SeedlingHistory ORDER BY receivedAt DESC LIMIT 1",
  ).run();
  return c.json(results[0] ?? null);
});

// Paginated history: GET /api/seedling/history?page=1&pageSize=50
app.get("/api/seedling/history", async (c) => {
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(c.req.query("pageSize") ?? "50", 10)),
  );
  const offset = (page - 1) * pageSize;

  const [dataRes, countRes] = await Promise.all([
    c.env.DB.prepare(
      "SELECT * FROM SeedlingHistory ORDER BY receivedAt DESC LIMIT ? OFFSET ?",
    )
      .bind(pageSize, offset)
      .run(),
    c.env.DB.prepare("SELECT COUNT(*) AS total FROM SeedlingHistory").run(),
  ]);

  const total = (countRes.results[0] as { total: number }).total;
  const totalPages = Math.ceil(total / pageSize);

  return c.json({
    data: dataRes.results,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
});

const dummyHasCommandsToSendBack = false;

app.post("/api/seedling", async (c) => {
  const body = await c.req.json();

  const {
    luxLvl,
    tempLvl,
    moistureLvl,
    waterLvl,
    waterRawADC,
    isLightOn,
    isFanOn,
    isFan2On,
    isMistingOn,
    fanBoost,
    fanCyclePos,
    mode,
    phase,
    nurseryDay,
    wifiOK,
    ntpOK,
    shtError,
    luxError,
    germHumidAlarm,
    waterLvlAlarm,
    germRemainingSeconds,
  } = body;

  console.log("Received data:", body);

  const parseResult = SeedlingDataSchema.safeParse({
    luxLvl,
    tempLvl,
    moistureLvl,
    waterLvl,
    waterRawADC,
    isLightOn,
    isFanOn,
    isFan2On,
    isMistingOn,
    fanBoost,
    fanCyclePos,
    mode,
    phase,
    nurseryDay,
    wifiOK,
    ntpOK,
    shtError,
    luxError,
    germHumidAlarm,
    waterLvlAlarm,
    germRemainingSeconds,
  });

  console.log("Validation result:", parseResult);

  if (!parseResult.success) {
    return c.json({ success: false, error: parseResult.error }, 400);
  }

  const d = parseResult.data;

  const boolCol = (v: boolean | undefined) =>
    v === undefined ? null : v ? 1 : 0;

  await c.env.DB.prepare(
    `INSERT INTO SeedlingHistory (
      luxLvl,
      tempLvl,
      moistureLvl,
      waterLvl,
      waterRawADC,
      isLightOn,
      isFanOn,
      isFan2On,
      isMistingOn,
      fanBoost,
      fanCyclePos,
      mode,
      phase,
      nurseryDay,
      wifiOK,
      ntpOK,
      shtError,
      luxError,
      germHumidAlarm,
      waterLvlAlarm,
      germRemainingSeconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      d.luxLvl,
      d.tempLvl,
      d.moistureLvl,
      d.waterLvl,
      d.waterRawADC ?? null,
      d.isLightOn ? 1 : 0,
      d.isFanOn ? 1 : 0,
      boolCol(d.isFan2On),
      d.isMistingOn ? 1 : 0,
      boolCol(d.fanBoost),
      d.fanCyclePos ?? null,
      d.mode,
      d.phase,
      d.nurseryDay ?? null,
      boolCol(d.wifiOK),
      boolCol(d.ntpOK),
      boolCol(d.shtError),
      boolCol(d.luxError),
      boolCol(d.germHumidAlarm),
      boolCol(d.waterLvlAlarm),
      d.germRemainingSeconds ?? null,
    )
    .run();

  const isManual = d.mode === "manual";

  if (dummyHasCommandsToSendBack && isManual) {
    const commandsToSendBack: CommandEntry[] = [
      {
        cmd: DeviceCommand.SetMode,
        params: { mode: "auto" },
      },
    ];
    console.log(
      "Sending commands back to device:",
      commandsToSendBack,
      "commands size:",
      commandsToSendBack.length,
    );
    return new Response(
      JSON.stringify({ success: true, commands: commandsToSendBack }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

export default app;
