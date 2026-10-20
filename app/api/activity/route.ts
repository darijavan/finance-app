import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/activity?limit=N  -> newest-first activity log entries.
// `undoable` is true for delete entries that still carry a restore snapshot.
export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
  const rows = db.prepare(
    "SELECT id, entity, action, entity_id, summary, payload IS NOT NULL AS has_payload, created_at FROM activity_log ORDER BY id DESC LIMIT ?"
  ).all(limit) as any[];
  
  return NextResponse.json(rows.map((r) => ({
    id: r.id, entity: r.entity, action: r.action, entity_id: r.entity_id,
    summary: r.summary, created_at: r.created_at,
    undoable: r.action === "delete" && !!r.has_payload,
  })));
}
