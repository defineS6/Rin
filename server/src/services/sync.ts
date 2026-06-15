import type { SyncArticle, SyncPullResponse, SyncPushArticle, SyncPushResponse } from "@rin/api";
import { SYNC_PROTOCOL_VERSION } from "@rin/api";
import { and, asc, eq, gt, or } from "drizzle-orm";
import { Hono } from "hono";
import type { Variables } from "../core/hono-types";
import { feeds } from "../db/schema";
import { bindTagToPost } from "./tag";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

function encodeCursor(updatedAt: Date, id: number) {
  return `${updatedAt.getTime()}:${id}`;
}

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return null;
  const [timestamp, id] = cursor.split(":").map(Number);
  if (!Number.isSafeInteger(timestamp) || !Number.isSafeInteger(id)) return null;
  return { updatedAt: new Date(timestamp), id };
}

export function SyncService(): Hono<{ Bindings: Env; Variables: Variables }> {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  app.use("*", async (c, next) => {
    if (!c.get("admin")) return c.text("Permission denied", 403);
    await next();
  });

  app.get("/capabilities", (c) =>
    c.json({
      protocolVersion: SYNC_PROTOCOL_VERSION,
      features: { articles: true, pull: true, push: true, softDelete: false },
      maxPageSize: MAX_PAGE_SIZE,
    }),
  );

  app.get("/articles", async (c) => {
    const db = c.get("db");
    const requestedLimit = Number(c.req.query("limit") || DEFAULT_PAGE_SIZE);
    const limit = Math.min(Math.max(Number.isSafeInteger(requestedLimit) ? requestedLimit : DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const cursorParam = c.req.query("cursor");
    const cursor = decodeCursor(cursorParam);

    if (cursorParam && !cursor) return c.text("Invalid cursor", 400);

    const where = cursor
      ? or(gt(feeds.updatedAt, cursor.updatedAt), and(eq(feeds.updatedAt, cursor.updatedAt), gt(feeds.id, cursor.id)))
      : undefined;
    const rows = await db.query.feeds.findMany({
      where,
      with: {
        hashtags: {
          columns: {},
          with: { hashtag: { columns: { name: true } } },
        },
      },
      orderBy: [asc(feeds.updatedAt), asc(feeds.id)],
      limit: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items: SyncArticle[] = page.map(({ hashtags, ...article }) => ({
      id: article.id,
      alias: article.alias,
      title: article.title,
      summary: article.summary,
      content: article.content,
      listed: article.listed === 1,
      draft: article.draft === 1,
      tags: hashtags.map(({ hashtag }) => hashtag.name).sort(),
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    }));
    const last = page.at(-1);
    const response: SyncPullResponse = {
      items,
      nextCursor: last ? encodeCursor(last.updatedAt, last.id) : cursorParam || null,
      hasMore,
    };
    return c.json(response);
  });

  app.post("/articles", async (c) => {
    const db = c.get("db");
    const cache = c.get("cache");
    const uid = c.get("uid");
    const body = await c.req.json<{ items?: SyncPushArticle[] }>();
    if (!uid) return c.text("User ID is required", 400);
    if (!Array.isArray(body.items)) return c.text("Items are required", 400);
    if (body.items.length > MAX_PAGE_SIZE) return c.text("Too many items", 400);

    const synced: SyncArticle[] = [];
    for (const item of body.items) {
      if (!item.title || !item.content) return c.text("Title and content are required", 400);
      const values = {
        alias: item.alias ?? null,
        title: item.title,
        summary: item.summary ?? "",
        content: item.content,
        listed: item.listed === false ? 0 : 1,
        draft: item.draft === true ? 1 : 0,
        updatedAt: new Date(),
      };
      let id = item.id;
      if (id) {
        const existing = await db.query.feeds.findFirst({ where: eq(feeds.id, id) });
        if (!existing) return c.text(`Article ${id} not found`, 404);
        await db.update(feeds).set(values).where(eq(feeds.id, id));
      } else {
        const result = await db.insert(feeds).values({
          ...values,
          uid,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        }).returning({ id: feeds.id });
        id = result[0].id;
      }
      if (!id) return c.text("Failed to save article", 500);
      await bindTagToPost(db, id, item.tags ?? []);
      const saved = await db.query.feeds.findFirst({
        where: eq(feeds.id, id),
        with: { hashtags: { columns: {}, with: { hashtag: { columns: { name: true } } } } },
      });
      if (saved) {
        synced.push({
          id: saved.id,
          alias: saved.alias,
          title: saved.title,
          summary: saved.summary,
          content: saved.content,
          listed: saved.listed === 1,
          draft: saved.draft === 1,
          tags: saved.hashtags.map(({ hashtag }) => hashtag.name).sort(),
          createdAt: saved.createdAt.toISOString(),
          updatedAt: saved.updatedAt.toISOString(),
        });
      }
    }
    await cache.deletePrefix("feeds_");
    return c.json({ items: synced } satisfies SyncPushResponse);
  });

  return app;
}
