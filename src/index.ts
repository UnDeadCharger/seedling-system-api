export interface Env {
  // If you set another name in the Wrangler config file for the value for 'binding',
  // replace "DB" with the variable name you defined.
  DB: D1Database;
}
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

// Helper for SQLite "Booleans" (0/1)
const sqliteBool = z
  .union([z.literal(0), z.literal(1)])
  .transform((v) => v === 1);

const SeedlingDataSchema = z.object({
  luxLvl: z.number(),
  tempLvl: z.number(),
  moistureLvl: z.number(),
  waterLvl: z.string(),

  // Boolean flags stored as 0 or 1 in SQLite
  isLightOn: sqliteBool,
  isFanOn: sqliteBool,
  isMistingOn: sqliteBool,
  isSystemOn: sqliteBool,

  mode: z.string(),
  phase: z.string(),
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
    isSystemOn,
  } = await c.req.json();

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
    isSystemOn,
  });

  if (!parseResult.success) {
    return c.json({ success: false, error: parseResult.error }, 400);
  }

  await c.env.DB.prepare(
    "INSERT INTO SeedlingHistory (luxLvl, tempLvl, moistureLvl, waterLvl, isLightOn, isFanOn, isMistingOn, mode, phase, isSystemOn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      luxLvl,
      tempLvl,
      moistureLvl,
      waterLvl,
      isLightOn,
      isFanOn,
      isMistingOn,
      mode,
      phase,
      isSystemOn,
    )
    .run();
  return c.json({ success: true });
});

export default app;
