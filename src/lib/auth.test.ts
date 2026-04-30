import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findActiveTokenByHash: vi.fn(),
  touchLastUsed: vi.fn(),
  hashToken: vi.fn((s: string) => `hash:${s}`),
  withAuth: vi.fn(),
  isEmailAllowed: vi.fn(),
}));

vi.mock("@/lib/api-tokens", () => ({
  findActiveTokenByHash: mocks.findActiveTokenByHash,
  touchLastUsed: mocks.touchLastUsed,
  hashToken: mocks.hashToken,
}));

vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: mocks.withAuth,
}));

vi.mock("@/lib/access", () => ({
  isEmailAllowed: mocks.isEmailAllowed,
}));

import { requireAuth, requireSessionAuth } from "./auth";

function reqWith(headers: Record<string, string>): Request {
  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
  } as unknown as Request;
}

beforeEach(() => {
  mocks.findActiveTokenByHash.mockReset();
  mocks.touchLastUsed.mockReset();
  mocks.hashToken.mockClear();
  mocks.hashToken.mockImplementation((s: string) => `hash:${s}`);
  mocks.withAuth.mockReset();
  mocks.isEmailAllowed.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("requireAuth — bearer path", () => {
  it("authenticates with a valid token, returns owner from DB row, and updates last_used_at", async () => {
    mocks.findActiveTokenByHash.mockResolvedValueOnce({
      id: "tok-1",
      ownerId: "user-42",
    });
    mocks.touchLastUsed.mockResolvedValueOnce(undefined);

    const result = await requireAuth(
      reqWith({ authorization: "Bearer mdk_secret" }),
    );

    expect(result).toEqual({
      authenticated: true,
      ownerId: "user-42",
      via: "bearer",
    });
    expect(mocks.hashToken).toHaveBeenCalledWith("mdk_secret");
    expect(mocks.touchLastUsed).toHaveBeenCalledWith("tok-1");
  });

  it("does not block the request if touchLastUsed throws", async () => {
    mocks.findActiveTokenByHash.mockResolvedValueOnce({
      id: "tok-1",
      ownerId: "user-42",
    });
    mocks.touchLastUsed.mockRejectedValueOnce(new Error("DB blip"));

    const result = await requireAuth(
      reqWith({ authorization: "Bearer mdk_secret" }),
    );
    expect(result.authenticated).toBe(true);
  });

  it("returns 401 when the bearer token is unknown to the DB", async () => {
    mocks.findActiveTokenByHash.mockResolvedValueOnce(null);

    const result = await requireAuth(
      reqWith({ authorization: "Bearer mdk_unknown" }),
    );

    expect(result).toEqual({
      authenticated: false,
      status: 401,
      reason: "Invalid API key",
    });
    expect(mocks.touchLastUsed).not.toHaveBeenCalled();
  });

  it("returns 401 'Empty bearer token' when the header has no value after Bearer", async () => {
    const result = await requireAuth(reqWith({ authorization: "Bearer " }));
    expect(result).toEqual({
      authenticated: false,
      status: 401,
      reason: "Empty bearer token",
    });
    expect(mocks.findActiveTokenByHash).not.toHaveBeenCalled();
  });
});

describe("requireAuth — session path", () => {
  it("authenticates an allow-listed signed-in user", async () => {
    mocks.withAuth.mockResolvedValueOnce({
      user: { id: "u-1", email: "ok@ex.com" },
    });
    mocks.isEmailAllowed.mockReturnValueOnce(true);

    const result = await requireAuth(reqWith({}));
    expect(result).toEqual({
      authenticated: true,
      ownerId: "u-1",
      via: "session",
    });
  });

  it("returns 401 'Not signed in' when there is no user", async () => {
    mocks.withAuth.mockResolvedValueOnce({ user: null });

    const result = await requireAuth(reqWith({}));
    expect(result).toEqual({
      authenticated: false,
      status: 401,
      reason: "Not signed in",
    });
  });

  it("returns 403 when the user's email is not on the allow list", async () => {
    mocks.withAuth.mockResolvedValueOnce({
      user: { id: "u-1", email: "blocked@ex.com" },
    });
    mocks.isEmailAllowed.mockReturnValueOnce(false);

    const result = await requireAuth(reqWith({}));
    expect(result).toEqual({
      authenticated: false,
      status: 403,
      reason: "Email not on allow list",
    });
  });
});

describe("requireSessionAuth", () => {
  it("rejects any request with a Bearer header — token-management is session-only", async () => {
    mocks.findActiveTokenByHash.mockResolvedValue({
      id: "tok-1",
      ownerId: "user-42",
    });

    const result = await requireSessionAuth(
      reqWith({ authorization: "Bearer mdk_real_token" }),
    );

    expect(result).toEqual({
      authenticated: false,
      status: 401,
      reason: "Session required for token management",
    });
    expect(mocks.findActiveTokenByHash).not.toHaveBeenCalled();
    expect(mocks.withAuth).not.toHaveBeenCalled();
  });

  it("authenticates an allow-listed signed-in user with email", async () => {
    mocks.withAuth.mockResolvedValueOnce({
      user: { id: "u-1", email: "ok@ex.com" },
    });
    mocks.isEmailAllowed.mockReturnValueOnce(true);

    const result = await requireSessionAuth(reqWith({}));
    expect(result).toEqual({
      authenticated: true,
      ownerId: "u-1",
      email: "ok@ex.com",
    });
  });

  it("returns 401 when no user", async () => {
    mocks.withAuth.mockResolvedValueOnce({ user: null });

    const result = await requireSessionAuth(reqWith({}));
    expect(result).toEqual({
      authenticated: false,
      status: 401,
      reason: "Not signed in",
    });
  });

  it("returns 403 when email is not allow-listed", async () => {
    mocks.withAuth.mockResolvedValueOnce({
      user: { id: "u-1", email: "blocked@ex.com" },
    });
    mocks.isEmailAllowed.mockReturnValueOnce(false);

    const result = await requireSessionAuth(reqWith({}));
    expect(result).toEqual({
      authenticated: false,
      status: 403,
      reason: "Email not on allow list",
    });
  });
});
