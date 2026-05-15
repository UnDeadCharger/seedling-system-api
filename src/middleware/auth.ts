import { createMiddleware } from "hono/factory";

import { Env } from "../types";

export const authMiddleware = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const key = c.req.header("x-api-key");
    if (key !== c.env.API_KEY) {
      return c.text("Unauthorized", 401);
    }
    await next();
  },
);
