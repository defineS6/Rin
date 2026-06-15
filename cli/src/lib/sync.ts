import type { SyncArticle, SyncCapabilities, SyncPullResponse, SyncPushArticle, SyncPushResponse } from "@rin/api";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export interface SyncConfig {
  remote: string;
  postsDir: string;
}

export interface SyncState {
  schemaVersion: 1;
  cursor: string | null;
  articles: Record<string, { path: string; hash: string; updatedAt: string }>;
}

const CONFIG_PATH = path.join(".rin", "config.json");
const STATE_PATH = path.join(".rin", "state.json");

export async function initializeSync(remote: string, postsDir: string) {
  await mkdir(".rin", { recursive: true });
  await mkdir(postsDir, { recursive: true });
  await writeJsonAtomic(CONFIG_PATH, { remote: remote.replace(/\/+$/, ""), postsDir });
  try {
    await readFile(STATE_PATH);
  } catch {
    await writeJsonAtomic(STATE_PATH, { schemaVersion: 1, cursor: null, articles: {} } satisfies SyncState);
  }
}

export async function loadSyncFiles() {
  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8")) as SyncConfig;
  const state = JSON.parse(await readFile(STATE_PATH, "utf8")) as SyncState;
  return { config, state };
}

export async function fetchCapabilities(config: SyncConfig, token: string) {
  return request<SyncCapabilities>(config, token, "/api/sync/capabilities");
}

export async function pullArticles(config: SyncConfig, state: SyncState, token: string, dryRun: boolean) {
  let cursor = state.cursor;
  let changed = 0;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const page = await request<SyncPullResponse>(config, token, `/api/sync/articles?${query}`);
    for (const article of page.items) {
      const relativePath = state.articles[String(article.id)]?.path || path.join(config.postsDir, articleFileName(article));
      const markdown = articleMarkdown(article);
      if (state.articles[String(article.id)]?.hash !== hash(markdown)) {
        changed++;
        if (!dryRun) {
          await mkdir(path.dirname(relativePath), { recursive: true });
          await writeFile(relativePath, markdown);
          state.articles[String(article.id)] = { path: relativePath, hash: hash(markdown), updatedAt: article.updatedAt };
        }
      }
    }
    cursor = page.nextCursor;
    if (!dryRun) state.cursor = cursor;
    if (!page.hasMore) break;
  } while (true);
  if (!dryRun) await writeJsonAtomic(STATE_PATH, state);
  return changed;
}

export async function localStatus(state: SyncState) {
  let modified = 0;
  let missing = 0;
  for (const entry of Object.values(state.articles)) {
    try {
      if (hash(await readFile(entry.path, "utf8")) !== entry.hash) modified++;
    } catch {
      missing++;
    }
  }
  return { tracked: Object.keys(state.articles).length, modified, missing };
}

export async function pushArticles(config: SyncConfig, state: SyncState, token: string, dryRun: boolean) {
  const files = await markdownFiles(config.postsDir);
  const pending: Array<{ path: string; article: SyncPushArticle }> = [];
  for (const file of files) {
    const content = await readFile(file, "utf8");
    const article = parseArticleMarkdown(content, path.basename(file, ".md"));
    const tracked = article.id ? state.articles[String(article.id)] : undefined;
    if (!tracked || tracked.hash !== hash(content)) pending.push({ path: file, article });
  }
  if (dryRun || pending.length === 0) return pending.length;

  for (let index = 0; index < pending.length; index += 100) {
    const batch = pending.slice(index, index + 100);
    const response = await request<SyncPushResponse>(config, token, "/api/sync/articles", {
      method: "POST",
      body: JSON.stringify({ items: batch.map(({ article }) => article) }),
    });
    for (let itemIndex = 0; itemIndex < response.items.length; itemIndex++) {
      const article = response.items[itemIndex];
      const file = batch[itemIndex].path;
      const markdown = articleMarkdown(article);
      await writeFile(file, markdown);
      state.articles[String(article.id)] = { path: file, hash: hash(markdown), updatedAt: article.updatedAt };
    }
  }
  await writeJsonAtomic(STATE_PATH, state);
  return pending.length;
}

function articleFileName(article: SyncArticle) {
  const name = (article.alias || article.title || `article-${article.id}`)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${name || `article-${article.id}`}.md`;
}

function articleMarkdown(article: SyncArticle) {
  const fields = [
    ["rin_id", String(article.id)],
    ["title", article.title || ""],
    ["slug", article.alias || ""],
    ["summary", article.summary],
    ["draft", String(article.draft)],
    ["listed", String(article.listed)],
    ["tags", JSON.stringify(article.tags)],
    ["created_at", article.createdAt],
    ["updated_at", article.updatedAt],
  ];
  return `---\n${fields.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}\n---\n\n${article.content.trimEnd()}\n`;
}

function parseArticleMarkdown(markdown: string, fallbackTitle: string): SyncPushArticle {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { title: fallbackTitle, content: markdown.trim() };
  const metadata: Record<string, unknown> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const raw = line.slice(separator + 1).trim();
    try {
      metadata[key] = JSON.parse(raw);
    } catch {
      metadata[key] = raw;
    }
  }
  const tagsValue = metadata.tags;
  const tags = Array.isArray(tagsValue)
    ? tagsValue.map(String)
    : typeof tagsValue === "string"
      ? (() => { try { return JSON.parse(tagsValue).map(String); } catch { return []; } })()
      : [];
  return {
    id: metadata.rin_id ? Number(metadata.rin_id) : undefined,
    title: String(metadata.title || ""),
    alias: String(metadata.slug || "") || null,
    summary: String(metadata.summary || ""),
    draft: String(metadata.draft) === "true",
    listed: String(metadata.listed) !== "false",
    tags,
    createdAt: metadata.created_at ? String(metadata.created_at) : undefined,
    content: match[2].trim(),
  };
}

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(file) : Promise.resolve(file.endsWith(".md") ? [file] : []);
  }));
  return files.flat().sort();
}

function hash(content: string) {
  return createHash("sha256").update(content.replace(/\r\n/g, "\n")).digest("hex");
}

async function request<T>(config: SyncConfig, token: string, pathname: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${config.remote}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error(`Sync API request failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<T>;
}

async function writeJsonAtomic(file: string, data: unknown) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`);
  await rename(temporary, file);
}
