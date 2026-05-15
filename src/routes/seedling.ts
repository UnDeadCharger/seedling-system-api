import { Hono } from "hono";

import { SeedlingDataSchema } from "../schema/seedling";
import { Env } from "../types";

const seedling = new Hono<{ Bindings: Env }>();

seedling.get("/latest", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM SeedlingHistory ORDER BY receivedAt DESC LIMIT 1",
  ).run();
  return c.json(results[0] ?? null);
});

seedling.get("/history", async (c) => {
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

seedling.post("/", async (c) => {
  const body = await c.req.json();
  const parseResult = SeedlingDataSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ success: false, error: parseResult.error }, 400);
  }

  const d = parseResult.data;
  const boolCol = (v: boolean | undefined) =>
    v === undefined ? null : v ? 1 : 0;

  await c.env.DB.prepare(
    `INSERT INTO SeedlingHistory (
      luxLvl, tempLvl, moistureLvl, waterLvl, waterRawADC,
      isLightOn, isFanOn, isFan2On, isMistingOn, fanBoost, fanCyclePos,
      mode, phase, nurseryDay, wifiOK, ntpOK,
      shtError, luxError, germHumidAlarm, waterLvlAlarm, germRemainingSeconds
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

  // Fetch pending commands (max 2 to stay under ESP32 600 byte buffer)
  const { results } = await c.env.DB.prepare(
    "SELECT id, cmd, params FROM CommandQueue WHERE cmdStatus = 'pending' ORDER BY createdAt ASC LIMIT 2",
  ).all();

  if (results.length > 0) {
    const commands = results.map((row) => ({
      cmd: row.cmd,
      params: JSON.parse(row.params as string),
    }));
    const ids = results.map((r) => r.id).join(",");
    await c.env.DB.prepare(
      `UPDATE CommandQueue SET cmdStatus = 'sent' WHERE id IN (${ids})`,
    ).run();
    return c.json({ success: true, commands });
  }

  return c.json({ success: true });
});

export default seedling;
