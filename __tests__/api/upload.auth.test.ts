/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "@/app/api/upload/route";
import { jobStore } from "@/app/api/jobs/shared/jobStore";

jest.mock("next-auth", () => ({ default: jest.fn(), getServerSession: jest.fn() }));
jest.mock("@/app/lib/auth", () => ({ authOptions: {} }));
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
jest.mock("@/app/lib/aiBackend", () => ({
  dispatchJob: jest.fn().mockResolvedValue({ dispatched: true, remoteJobId: "job-abc" }),
}));

import { getServerSession } from "next-auth";
const mockGetServerSession = getServerSession as jest.Mock;

const APP_ORIGIN = "http://localhost:3000";

function makeUploadRequest(file?: File) {
  const formData = new FormData();
  if (file) formData.append("files", file);
  return new NextRequest("http://localhost/api/upload", {
    method: "POST",
    body: formData,
    headers: { origin: APP_ORIGIN },
  });
}

function makeVideoFile(name = "video.mp4", size = 1024) {
  return new File([new Uint8Array(size)], name, { type: "video/mp4" });
}

beforeEach(() => {
  process.env.NEXTAUTH_URL = APP_ORIGIN;
  jobStore.clear();
  mockGetServerSession.mockReset();
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("POST /api/upload", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeUploadRequest(makeVideoFile()));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when session has no user id", async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: "test@example.com" } });
    const res = await POST(makeUploadRequest(makeVideoFile()));
    expect(res.status).toBe(401);
  });

  it("registers job in 'queued' state and dispatches to AI backend", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-123" } });
    const res = await POST(makeUploadRequest(makeVideoFile()));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.jobId).toBe("job-abc");

    const job = jobStore.get("job-abc");
    expect(job).toBeDefined();
    expect(job?.userId).toBe("user-123");
    expect(job?.status).toBe("queued");
    expect(job?.progress).toBe(0);
  });

  it("calls dispatchJob with correct payload", async () => {
    const { dispatchJob } = jest.requireMock("@/app/lib/aiBackend");
    mockGetServerSession.mockResolvedValue({ user: { id: "user-123" } });

    await POST(makeUploadRequest(makeVideoFile()));

    expect(dispatchJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-abc",
        userId: "user-123",
        objectKey: "uploads/video.mp4",
        callbackUrl: expect.stringContaining("/api/jobs/job-abc/callback"),
      })
    );
  });

  it("returns 400 when no files are provided", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-123" } });
    const res = await POST(makeUploadRequest());
    expect(res.status).toBe(400);
  });
});
