import { drizzle } from "drizzle-orm/d1";
import { CacheImpl } from "../utils/cache";

function isScheduledTasksEnabled(env: Env) {
  const value = env.SCHEDULED_TASKS_ENABLED;
  if (value === undefined || value.trim() === "") {
    return true;
  }

  return !["0", "false", "off", "no", "disabled"].includes(value.trim().toLowerCase());
}

export async function handleScheduled(
  _controller: ScheduledController | null,
  env: Env,
  ctx: ExecutionContext,
) {
  if (!isScheduledTasksEnabled(env)) {
    console.info("scheduled tasks disabled by SCHEDULED_TASKS_ENABLED");
    return;
  }

  const schema = await import("../db/schema");
  const db = drizzle(env.DB, { schema });

  const serverConfig = new CacheImpl(db, env, "server.config", "database");
  const clientConfig = new CacheImpl(db, env, "client.config");
  const cache = new CacheImpl(db, env, "cache", undefined, clientConfig);

  const { friendCrontab } = await import("../services/friends");
  const { rssCrontab } = await import("../services/rss");

  await friendCrontab(env, ctx, db, cache, serverConfig, clientConfig);
  await rssCrontab(env, db);
}
