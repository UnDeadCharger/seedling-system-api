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

//history return { data: Row[], total: number, page: number, pageSize: number, totalPages: number }
//example params: from=2026-05-15T00:00:00Z&to=2026-05-16T00:00:00Z&page=1&pageSize=50&sortBy=receivedAt&order=desc
seedling.get("/history", async (c) => {
  const from = c.req.query("from");
  const to = c.req.query("to");
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(c.req.query("pageSize") ?? "50", 10)),
  );
  const sortBy = c.req.query("sortBy") || "receivedAt";
  const order = c.req.query("order") === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * pageSize;

  console.log(
    `Fetching history from ${from} to ${to}, page ${page}, pageSize ${pageSize}, sortBy ${sortBy}, order ${order}`,
  );

  // Validate sortBy to prevent SQL injection
  const validSortColumns = [
    "receivedAt",
    "tempLvl",
    "moistureLvl",
    "luxLvl",
    "waterLvl",
    "nurseryDay",
  ];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "receivedAt";
  const orderDir = order === "ASC" ? "ASC" : "DESC";

  const [dataRes, countRes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT * FROM SeedlingHistory WHERE receivedAt BETWEEN ? AND ? ORDER BY ${sortColumn} ${orderDir} LIMIT ? OFFSET ?`,
    )
      .bind(from, to, pageSize, offset)
      .all(),
    c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM SeedlingHistory WHERE receivedAt BETWEEN ? AND ?",
    )
      .bind(from, to)
      .all(),
  ]);

  const total = (countRes.results[0] as { total: number }).total;
  const totalPages = Math.ceil(total / pageSize);

  return c.json({
    data: dataRes.results,
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  });
});
//return value { data: [{ hour, avgTemp, avgHumid, avgLux, lightOnPct, fanOnPct, mistOnPct }] }
//example params: from=2024-01-01T00:00:00Z&to=2024-01-07T00:00:00Z
seedling.get("/chart", async (c) => {
  const from = c.req.query("from");
  const to = c.req.query("to");

  if (!from || !to) {
    return c.text("Missing 'from' or 'to' query parameters", 400);
  }
  //if longer than 7 days, reject
  if (
    new Date(to).getTime() - new Date(from).getTime() >
    7 * 24 * 60 * 60 * 1000
  ) {
    return c.text("Date range too long. Max is 7 days.", 400);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT
        strftime('%Y-%m-%dT%H:00:00Z', receivedAt) AS hour,
        AVG(tempLvl)       AS avgTemp,
        AVG(moistureLvl)   AS avgHumid,
        AVG(luxLvl)        AS avgLux,
        AVG(CASE WHEN isLightOn  = 1 THEN 1.0 ELSE 0.0 END) AS lightOnPct,
        AVG(CASE WHEN isFanOn    = 1 THEN 1.0 ELSE 0.0 END) AS fanOnPct,
        AVG(CASE WHEN isMistingOn= 1 THEN 1.0 ELSE 0.0 END) AS mistOnPct
    FROM SeedlingHistory
    WHERE receivedAt BETWEEN ? AND ?
    AND ((shtError = 0 AND luxError = 0) or (shtError IS NULL AND luxError IS NULL))
    GROUP BY hour
    ORDER BY hour ASC`,
  )
    .bind(from, to)
    .all();

  return c.json({ data: results });
});

//example params: from=2024-01-01T00:00:00Z&to=2024-01-07T00:00:00Z
seedling.get("/export", async (c) => {
  const from = c.req.query("from");
  const to = c.req.query("to");
  if (!from || !to) {
    return c.text("Missing 'from' or 'to' query parameters", 400);
  }
  //if longer than 7 days, reject
  if (
    new Date(to).getTime() - new Date(from).getTime() >
    7 * 24 * 60 * 60 * 1000
  ) {
    return c.text("Date range too long. Max is 7 days.", 400);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM SeedlingHistory
        WHERE receivedAt BETWEEN ? AND ?
        ORDER BY receivedAt DESC`,
  )
    .bind(from, to)
    .all();

  return c.json({ data: results });
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
