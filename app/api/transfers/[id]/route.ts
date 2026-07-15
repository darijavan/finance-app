import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

// DELETE /api/transfers/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);
  const row = db.prepare("SELECT * FROM transfers WHERE id=?").get(id) as any;
  if (!row) return NextResponse.json({ ok: true, log_id: null });
  db.prepare("DELETE FROM transfers WHERE id=?").run(id);
  const logId = logActivity(db, "transfer", "delete", id,
    `Deleted transfer #${id} (${row.amount} ${row.currency || ""})`,
    { table: "transfers", ...row });
  return NextResponse.json({ ok: true, log_id: logId });
}
