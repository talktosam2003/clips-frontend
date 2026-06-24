/**
 * @jest-environment node
 *
 * CSRF integration tests for POST /api/upload.
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/upload/route";

jest.mock("next-auth", () => ({ default: jest.fn(), getServerSession: jest.fn() }));
jest.mock("@/app/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/app/lib/aiBackend", () => ({
  dispatchJob: jest.fn().mockResolvedValue({ dispatched: true }),
}));
jest.mock("@/app/lib/cloudStorage", () => ({
  uploadToQuarantine: jest.fn().mockResolvedValue({
    jobId: "job-abc",
    filename: "video.mp4",
    quarantineKey: "uploads/quarantine/video.mp4",
  }),
  moveFromQuarantine: jest.fn().mockResolvedValue({
    jobId: "job-abc",
    filename: "video.mp4",
    objectKey: "uploads/video.mp4",
    url: "https://cdn.example.com/video.mp4",
  }),
  deleteFile: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/app/lib/virusScan", () => ({
  scanFile: jest.fn().mockResolvedValue({ isClean: true, provider: "mock" }),
  getScanConfig: jest.fn().mockReturnValue({ enabled: true, provider: "mock" }),
  VirusScanError: class VirusScanError extends Error {},
}));

import { getServerSession } from "next-auth";
const mockGetServerSession = getServerSession as jest.Mock;

const APP_ORIGIN = "https://app.example.com";

beforeEach(() => {
  process.env.NEXTAUTH_URL = APP_ORIGIN;
  mockGetServerSession.mockResolvedValue({ user: { id: "user-123" } });
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function makeRequest(headers: Record<string, string> = {}, withFile = true) {
  const formData = new FormData();
  if (withFile) {
    formData.append(
      "files",
      new File([new Uint8Array(512)], "video.mp4", { type: "video/mp4" })
    );
  }
  return new NextRequest("http://localhost/api/upload", {
    method: "POST",
    body: formData,
    headers,
  });
}

describe("POST /api/upload — CSRF protection", () => {
  it("allows same-origin requests (matching Origin header)", async () => {
    const res = await POST(makeRequest({ origin: APP_ORIGIN }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("allows same-origin requests identified via Referer header", async () => {
    const res = await POST(makeRequest({ referer: `${APP_ORIGIN}/clips` }));
    expect(res.status).toBe(200);
  });

  it("blocks cross-origin requests with 403", async () => {
    const res = await POST(makeRequest({ origin: "https://evil.com" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: "Forbidden" });
  });

  it("blocks requests with no Origin or Referer header", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });

  it("CSRF block precedes auth — unauthenticated cross-origin request returns 403 not 401", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ origin: "https://attacker.io" }));
    expect(res.status).toBe(403);
  });
});
