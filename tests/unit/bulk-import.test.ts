/**
 * Tests for POST /api/players/bulk-import
 */

jest.mock("@/lib/db", () => ({
  prisma: {
    tournament: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/import/import-service", () => ({
  createImportJob: jest.fn(),
  processImportJob: jest.fn(),
}));

jest.mock("@/lib/auth-helpers", () => ({
  getCurrentUser: jest.fn().mockResolvedValue(null),
}));

import { prisma } from "@/lib/db";
import { createImportJob, processImportJob } from "@/lib/import/import-service";
import { getCurrentUser } from "@/lib/auth-helpers";
import { POST as bulkImportPost } from "@/app/api/players/bulk-import/route";
import { NextRequest } from "next/server";

const mockFindMany = prisma.tournament.findMany as jest.Mock;
const mockCreateImportJob = createImportJob as jest.Mock;
const mockProcessImportJob = processImportJob as jest.Mock;
const mockGetCurrentUser = getCurrentUser as jest.Mock;

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/players/bulk-import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(null);
  mockProcessImportJob.mockResolvedValue(undefined);
});

describe("POST /api/players/bulk-import", () => {
  it("queues new URLs, skips existing ones, returns correct queued/skipped/jobIds", async () => {
    const existingUrl = "https://s2.chess-results.com/tnr111.aspx";
    const newUrl1 = "https://s2.chess-results.com/tnr222.aspx";
    const newUrl2 = "https://s2.chess-results.com/tnr333.aspx";

    mockFindMany.mockResolvedValue([{ sourceUrl: existingUrl }]);
    mockCreateImportJob
      .mockResolvedValueOnce("job-id-1")
      .mockResolvedValueOnce("job-id-2");

    const req = makeRequest({
      tournamentUrls: [existingUrl, newUrl1, newUrl2],
    });

    const res = await bulkImportPost(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.queued).toBe(2);
    expect(body.skipped).toBe(1);
    expect(body.jobIds).toEqual(["job-id-1", "job-id-2"]);

    expect(mockCreateImportJob).toHaveBeenCalledTimes(2);
    expect(mockCreateImportJob).toHaveBeenCalledWith(
      { sourceType: "chess-results", url: newUrl1 },
      undefined
    );
    expect(mockCreateImportJob).toHaveBeenCalledWith(
      { sourceType: "chess-results", url: newUrl2 },
      undefined
    );

    // processImportJob should be called fire-and-forget (not awaited in test but still called)
    // Give microtasks a chance to flush
    await new Promise(resolve => setImmediate(resolve));
    expect(mockProcessImportJob).toHaveBeenCalledWith("job-id-1");
    expect(mockProcessImportJob).toHaveBeenCalledWith("job-id-2");
  });

  it("passes userId when user is authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-abc" });
    mockFindMany.mockResolvedValue([]);
    mockCreateImportJob.mockResolvedValue("job-id-x");

    const req = makeRequest({
      tournamentUrls: ["https://s2.chess-results.com/tnr999.aspx"],
    });

    await bulkImportPost(req);

    expect(mockCreateImportJob).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "chess-results" }),
      "user-abc"
    );
  });

  it("returns 400 for empty tournamentUrls array", async () => {
    const req = makeRequest({ tournamentUrls: [] });
    const res = await bulkImportPost(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
    expect(mockCreateImportJob).not.toHaveBeenCalled();
  });

  it("returns 400 when tournamentUrls field is missing", async () => {
    const req = makeRequest({ someOtherField: "value" });
    const res = await bulkImportPost(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
    expect(mockCreateImportJob).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected errors", async () => {
    mockFindMany.mockRejectedValue(new Error("DB connection failed"));

    const req = makeRequest({
      tournamentUrls: ["https://s2.chess-results.com/tnr123.aspx"],
    });

    const res = await bulkImportPost(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBeDefined();
  });
});
