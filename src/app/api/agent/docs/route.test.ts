import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { createApiToken } from "@/lib/api-tokens";

vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: vi.fn(async () => ({ user: null })),
}));

import { POST } from "./route";

const TEST_OWNER = "__test_agent_create_doc__";

beforeAll(() => {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL not set — route tests need .env.local.");
  }
});

afterAll(async () => {
  await sql`DELETE FROM api_tokens WHERE owner_id = ${TEST_OWNER}`;
  await sql`DELETE FROM docs WHERE owner_id = ${TEST_OWNER}`;
});

function postReq(body: unknown, token: string | null) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const req = new NextRequest("http://localhost/api/agent/docs", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return POST(req);
}

describe("POST /api/agent/docs", () => {
  it("creates a doc with content, returns 201 + slug + viewUrl", async () => {
    const token = await createApiToken(TEST_OWNER, "test");
    const res = await postReq(
      { content: "# Hello agent\n\nbody\n" },
      token.plaintext,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      slug: string;
      title: string;
      content: string;
      viewUrl: string;
      createdAt: string;
    };
    expect(body.slug).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(body.title).toBe("Hello agent");
    expect(body.content).toBe("# Hello agent\n\nbody\n");
    expect(body.viewUrl).toContain(`/v/${body.slug}`);
  });

  it("respects an explicit title in the JSON body", async () => {
    const token = await createApiToken(TEST_OWNER, "test");
    const res = await postReq(
      { content: "# h1 wins by default\nx\n", title: "Override" },
      token.plaintext,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { title: string };
    expect(body.title).toBe("Override");
  });

  it("returns 400 when content is missing", async () => {
    const token = await createApiToken(TEST_OWNER, "test");
    const res = await postReq({ title: "no body" }, token.plaintext);
    expect(res.status).toBe(400);
  });

  it("returns 400 when content is empty", async () => {
    const token = await createApiToken(TEST_OWNER, "test");
    const res = await postReq({ content: "   \n" }, token.plaintext);
    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await postReq({ content: "x\n" }, null);
    expect(res.status).toBe(401);
  });

  it("returns 413 when content exceeds 1MB", async () => {
    const token = await createApiToken(TEST_OWNER, "test");
    const huge = "x".repeat(1024 * 1024 + 10);
    const res = await postReq({ content: huge }, token.plaintext);
    expect(res.status).toBe(413);
  });

  it("returns 400 for invalid JSON body", async () => {
    const token = await createApiToken(TEST_OWNER, "test");
    const req = new NextRequest("http://localhost/api/agent/docs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token.plaintext}`,
      },
      body: "{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
