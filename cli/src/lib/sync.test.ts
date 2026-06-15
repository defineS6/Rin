import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { initializeSync, loadSyncFiles, localStatus, pushArticles } from "./sync";

let previousDirectory = "";
let temporaryDirectory = "";

afterEach(async () => {
  if (previousDirectory) process.chdir(previousDirectory);
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("local sync state", () => {
  it("initializes configuration without storing a token", async () => {
    previousDirectory = process.cwd();
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "rin-sync-"));
    process.chdir(temporaryDirectory);

    await initializeSync("https://blog.example.com/", "content");

    const { config, state } = await loadSyncFiles();
    expect(config).toEqual({ remote: "https://blog.example.com", postsDir: "content" });
    expect(state).toEqual({ schemaVersion: 1, cursor: null, articles: {} });
    expect(await readFile(".rin/config.json", "utf8")).not.toContain("token");
    expect(await localStatus(state)).toEqual({ tracked: 0, modified: 0, missing: 0 });
  });

  it("pushes a plain Markdown file and writes remote metadata", async () => {
    previousDirectory = process.cwd();
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "rin-sync-"));
    process.chdir(temporaryDirectory);
    await initializeSync("https://blog.example.com", "posts");
    await Bun.write("posts/hello.md", "# Hello");
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.items[0]).toMatchObject({ title: "hello", content: "# Hello" });
      return Response.json({
        items: [{
          id: 7, alias: null, title: "hello", summary: "", content: "# Hello",
          listed: true, draft: false, tags: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
        }],
      });
    }) as typeof fetch;
    try {
      const { config, state } = await loadSyncFiles();
      expect(await pushArticles(config, state, "token", false)).toBe(1);
      expect(await readFile("posts/hello.md", "utf8")).toContain('rin_id: "7"');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
