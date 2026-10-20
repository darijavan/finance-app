import { NextRequest, NextResponse } from "next/server";
import { getDb, undoActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/activity/[id]/undo
// Reverses a logged delete by re-inserting its snapshot. Only deletions carry
// a restore payload, so non-delete or already-undone entries return 409.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const logId = Number((await params).id);
  const newId = undoActivity(db, logId);
  if (newId == null) {
    
    return NextResponse.json({ error: "This action can't be undone (not a reversible delete or already undone)." }, { status: 409 });
  }
  
  return NextResponse.json({ ok: true, restored_id: newId });
}
