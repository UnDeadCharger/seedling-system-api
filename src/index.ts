export interface Env {
  // If you set another name in the Wrangler config file for the value for 'binding',
  // replace "DB" with the variable name you defined.
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

// Usage: typed command entry
export type CommandEntry<C extends DeviceCommand = DeviceCommand> = {
  cmd: C;
  params: CommandPayload[C];
};

// Helper for SQLite "Booleans" (0/1) or actual booleans
const sqliteBool = z
  .union([z.literal(0), z.literal(1), z.boolean()])
  .transform((v) => v === 1 || v === true);

const SeedlingDataSchema = z.object({
  luxLvl: z.number().default(-1),
  tempLvl: z.number().default(-1),
  moistureLvl: z.number().default(-1),
  waterLvl: z.string().default("Unknown"),

  // Boolean flags stored as 0 or 1 in SQLite
  isLightOn: sqliteBool,
  isFanOn: sqliteBool,
  isMistingOn: sqliteBool,

  mode: z.string(),
  phase: z.string(),

  dhtError: sqliteBool.optional(),
  luxError: sqliteBool.optional(),
  germHudmidAlarm: sqliteBool.optional(),
  waterLvlAlarm: sqliteBool.optional(),
  germRemainingSeconds: z.number().optional(),
});

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.get("/api/seedling/latest", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM SeedlingHistory ORDER BY receivedAt DESC LIMIT 1",
  ).run();
  return c.json(results[0]);
});

app.get("/api/seedling/history", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM SeedlingHistory ORDER BY receivedAt DESC",
  ).run();
  return c.json(results);
});

const dummyHasCommandsToSendBack = false; // Replace with actual logic to determine if there are commands to send back

app.post("/api/seedling", async (c) => {
  const {
    luxLvl,
    tempLvl,
    moistureLvl,
    waterLvl,
    isLightOn,
    isFanOn,
    isMistingOn,
    mode,
    phase,
    dhtError,
    luxError,
    germHudmidAlarm,
    waterLvlAlarm,
    germRemainingSeconds,
  } = await c.req.json();
  console.log("Received data:", {
    luxLvl,
    tempLvl,
    moistureLvl,
    waterLvl,
    isLightOn,
    isFanOn,
    isMistingOn,
    mode,
    phase,
    dhtError,
    luxError,
    germHudmidAlarm,
    waterLvlAlarm,
    germRemainingSeconds,
  });

  console.log("request body:", await c.req.json());
  // Validate the incoming data
  const parseResult = SeedlingDataSchema.safeParse({
    luxLvl,
    tempLvl,
    moistureLvl,
    waterLvl,
    isLightOn,
    isFanOn,
    isMistingOn,
    mode,
    phase,
    dhtError,
    luxError,
    germHudmidAlarm,
    waterLvlAlarm,
    germRemainingSeconds,
  });
  console.log("Validation result:", parseResult);
  if (!parseResult.success) {
    return c.json({ success: false, error: parseResult.error }, 400);
  }

  console.log("Parsed data:", parseResult.data);

  await c.env.DB.prepare(
    `INSERT INTO SeedlingHistory (
      luxLvl,
      tempLvl,
      moistureLvl,
      waterLvl,
      isLightOn,
      isFanOn,
      isMistingOn,
      mode,
      phase,
      dhtError,
      luxError,
      germHudmidAlarm,
      waterLvlAlarm,
      germRemainingSeconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      parseResult.data.luxLvl,
      parseResult.data.tempLvl,
      parseResult.data.moistureLvl,
      parseResult.data.waterLvl,
      parseResult.data.isLightOn ? 1 : 0,
      parseResult.data.isFanOn ? 1 : 0,
      parseResult.data.isMistingOn ? 1 : 0,
      parseResult.data.mode,
      parseResult.data.phase,
      parseResult.data.dhtError || null,
      parseResult.data.luxError || null,
      parseResult.data.germHudmidAlarm !== undefined
        ? parseResult.data.germHudmidAlarm
          ? 1
          : 0
        : null,
      parseResult.data.waterLvlAlarm !== undefined
        ? parseResult.data.waterLvlAlarm
          ? 1
          : 0
        : null,
      parseResult.data.germRemainingSeconds || null,
    )
    .run();

  //has commands to send back to the device, we can include them in the response
  const isGermination = parseResult.data.phase === "germination";
  const isManual = parseResult.data.mode === "manual";
  if (dummyHasCommandsToSendBack && isManual) {
    const commandsToSendBack: CommandEntry[] = [
      // {
      //   cmd: DeviceCommand.SetPhase,
      //   params: { phase: "nursery" },
      // },
      // {
      //   cmd: DeviceCommand.ManualRun,
      //   params: { light: 0, fan: 1, mist: 1 },
      // },
      {
        cmd: DeviceCommand.SetMode,
        params: { mode: "auto" },
      },
    ];
    console.log(
      "Sending commands back to device:",
      commandsToSendBack,
      "commands size",
      commandsToSendBack.length,
    );
    return new Response(
      JSON.stringify({ success: true, commands: commandsToSendBack }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

export default app;
