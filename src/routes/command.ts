import { Hono } from "hono";

import { CommandSchema } from "../schema/command";
import { Env } from "../types";

const command = new Hono<{ Bindings: Env }>();

command.post("/", async (c) => {
  const body = await c.req.json();
  const parseResult = CommandSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ success: false, error: parseResult.error }, 400);
  }

  const { cmd, params } = parseResult.data;
  await c.env.DB.prepare("INSERT INTO CommandQueue (cmd, params) VALUES (?, ?)")
    .bind(cmd, JSON.stringify(params ?? {}))
    .run();

  return c.json({ success: true });
});

command.get("/pending", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM CommandQueue WHERE status = 'pending' ORDER BY createdAt ASC",
  ).run();
  return c.json(results);
});

export default command;
