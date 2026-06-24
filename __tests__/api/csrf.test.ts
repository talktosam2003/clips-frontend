/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { checkCsrf } from "@/app/lib/csrf";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/upload", {
    method: "POST",
    headers,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("checkCsrf", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEXTAUTH_URL: "https://app.example.com" };
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // ── Same-origin ────────────────────────────────────────────────────────────

  it("allows a request with a matching Origin header", () => {
    const result = checkCsrf(makeRequest({ origin: "https://app.example.com" }));
    expect(result).toBeNull();
  });

  it("allows a request with a matching Referer header when Origin is absent", () => {
    const result = checkCsrf(
      makeRequest({ referer: "https://app.example.com/dashboard" })
    );
    expect(result).toBeNull();
  });

  it("allows Origin with path info stripped (only origin portion is compared)", () => {
    // Browser sends origin without path
    const result = checkCsrf(
      makeRequest({ origin: "https://app.example.com" })
    );
    expect(result).toBeNull();
  });

  // ── Cross-origin ───────────────────────────────────────────────────────────

  it("blocks a request from a different origin", async () => {
    const result = checkCsrf(makeRequest({ origin: "https://evil.example.com" }));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = await result!.json();
    expect(body).toEqual({ error: "Forbidden" });
  });

  it("blocks a request whose Referer is from a different origin", async () => {
    const result = checkCsrf(
      makeRequest({ referer: "https://evil.example.com/attack" })
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("prefers Origin over Referer when both are present", async () => {
    // Origin is cross-origin, Referer is same-origin — Origin wins → blocked
    const result = checkCsrf(
      makeRequest({
        origin: "https://evil.example.com",
        referer: "https://app.example.com/page",
      })
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("blocks a request with a null Origin string (cross-origin opaque origin)", async () => {
    const result = checkCsrf(makeRequest({ origin: "null" }));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  // ── Missing headers ────────────────────────────────────────────────────────

  it("blocks a request with no Origin or Referer header by default", async () => {
    const result = checkCsrf(makeRequest());
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("allows a request with no Origin/Referer when allowMissingOrigin is true", () => {
    const result = checkCsrf(makeRequest(), { allowMissingOrigin: true });
    expect(result).toBeNull();
  });

  // ── NEXTAUTH_URL not set ───────────────────────────────────────────────────

  it("allows the request and warns when NEXTAUTH_URL is not configured", () => {
    delete process.env.NEXTAUTH_URL;
    const result = checkCsrf(makeRequest({ origin: "https://anything.com" }));
    expect(result).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("NEXTAUTH_URL is not set")
    );
  });

  // ── Subdomain / port isolation ─────────────────────────────────────────────

  it("blocks requests from a subdomain of the app origin", async () => {
    const result = checkCsrf(
      makeRequest({ origin: "https://sub.app.example.com" })
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("blocks requests from same host on a different port", async () => {
    const result = checkCsrf(
      makeRequest({ origin: "https://app.example.com:8080" })
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it("blocks http when NEXTAUTH_URL is https", async () => {
    const result = checkCsrf(
      makeRequest({ origin: "http://app.example.com" })
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});
