import type { SyncCapabilities, SyncPullResponse, SyncPushResponse } from "@rin/api";
import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanupTestDB, createTestUser, setupTestApp } from "../../../tests/fixtures";
import { SyncService } from "../sync";

describe("SyncService", () => {
  let sqlite: Database;
  let app: Awaited<ReturnType<typeof setupTestApp>>["app"];
  let env: Env;

  beforeEach(async () => {
    const context = await setupTestApp(SyncService);
    sqlite = context.sqlite;
    app = context.app;
    env = context.env;
    createTestUser(sqlite);
    sqlite.exec("INSERT INTO feeds (id, title, content, uid, draft, listed) VALUES (1, 'Hello', 'Body', 1, 0, 1)");
  });

  afterEach(() => cleanupTestDB(sqlite));

  it("returns capabilities and pulls articles for administrators", async () => {
    const headers = { Authorization: "Bearer mock_token_1" };
    const capabilities = await app.request("/capabilities", { headers }, env);
    expect(capabilities.status).toBe(200);
    const capabilitiesBody = await capabilities.json() as SyncCapabilities;
    expect(capabilitiesBody.features.pull).toBe(true);

    const response = await app.request("/articles", { headers }, env);
    expect(response.status).toBe(200);
    const result = await response.json() as SyncPullResponse;
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: 1, title: "Hello", content: "Body", draft: false, listed: true });
  });

  it("creates and overwrites articles pushed by administrators", async () => {
    const headers = { Authorization: "Bearer mock_token_1", "Content-Type": "application/json" };
    const created = await app.request("/articles", {
      method: "POST",
      headers,
      body: JSON.stringify({ items: [{ title: "Local", content: "Created locally", tags: ["sync"] }] }),
    }, env);
    expect(created.status).toBe(200);
    const createdBody = await created.json() as SyncPushResponse;
    expect(createdBody.items[0]).toMatchObject({ title: "Local", content: "Created locally", tags: ["sync"] });

    const updated = await app.request("/articles", {
      method: "POST",
      headers,
      body: JSON.stringify({ items: [{ id: 1, title: "Overwritten", content: "New body" }] }),
    }, env);
    expect(updated.status).toBe(200);
    const updatedBody = await updated.json() as SyncPushResponse;
    expect(updatedBody.items[0]).toMatchObject({ id: 1, title: "Overwritten", content: "New body" });
  });
});
