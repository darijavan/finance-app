import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { prepare: vi.fn() },
  logActivity: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db, logActivity: mocks.logActivity }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile, mkdir: vi.fn(), writeFile: vi.fn(), rm: vi.fn() }));

const route = await import("../app/api/transactions/[id]/receipt/route");
const params = { params: Promise.resolve({ id: "9" }) };

afterEach(() => {
  vi.clearAllMocks();
});

describe("transaction receipt route", () => {
  it("serves receipts as private downloads with sanitized attachment metadata", async () => {
    mocks.db.prepare.mockReturnValue({ get: () => ({ receipt_key: "123e4567-e89b-12d3-a456-426614174000", receipt_name: "../../invoice 1.pdf", receipt_mime: "application/pdf" }) });
    mocks.readFile.mockResolvedValue(Buffer.from("%PDF-safe"));

    const response = await route.GET(new NextRequest("http://localhost/api/transactions/9/receipt"), params);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe("attachment; filename*=UTF-8''invoice_1.pdf");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe("%PDF-safe");
  });

  it("serves receipts inline for the in-app viewer without weakening the download default", async () => {
    mocks.db.prepare.mockReturnValue({ get: () => ({ receipt_key: "123e4567-e89b-12d3-a456-426614174000", receipt_name: "invoice 1.pdf", receipt_mime: "application/pdf" }) });
    mocks.readFile.mockResolvedValue(Buffer.from("%PDF-safe"));

    const response = await route.GET(new NextRequest("http://localhost/api/transactions/9/receipt?view=1"), params);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe("inline; filename*=UTF-8''invoice_1.pdf");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("does not expose missing receipt files", async () => {
    mocks.db.prepare.mockReturnValue({ get: () => ({ receipt_key: "123e4567-e89b-12d3-a456-426614174000", receipt_name: "invoice.pdf", receipt_mime: "application/pdf" }) });
    mocks.readFile.mockRejectedValue(new Error("ENOENT"));

    const response = await route.GET(new NextRequest("http://localhost/api/transactions/9/receipt"), params);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "receipt not found" });
  });

  it("rejects receipt uploads for locked subscription charges", async () => {
    mocks.db.prepare.mockReturnValue({ get: () => ({ subscription_id: 4, receipt_key: null, receipt_name: null }) });

    const response = await route.POST(new NextRequest("http://localhost/api/transactions/9/receipt", { method: "POST" }), params);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "subscription charges are read-only" });
  });
});
