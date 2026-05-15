import { Hono } from "hono";
import { cors } from "hono/cors";

import { authMiddleware } from "./middleware/auth";
import command from "./routes/command";
import seedling from "./routes/seedling";
import { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use("*", authMiddleware);
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "x-api-key", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.route("/api/seedling", seedling);
app.route("/api/commands", command);

export default app;
