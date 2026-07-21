import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { money, isoDate, optionalId } from "@/lib/validate";

export const dynamic = "force-dynamic";

// PUT|DELETE /api/goals/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const id = Number((await params).id);
  const before = db.prepare("SELECT * FROM goals WHERE id=?").get(id) as any;
  if (!before) return NextResponse.json({ error: "goal not found" }, { status: 404 });
  const b = await req.json();
  const name = "name" in b ? String(b.name ?? "").trim() : before.name;
  const target = "target_amount" in b ? money(b.target_amount) : before.target_amount;
  const account_id = "account_id" in b ? optionalId(b.account_id) : before.account_id;
  const target_date = "target_date" in b ? (b.target_date ? isoDate(b.target_date) : null) : before.target_date;
  if (!name || target == null || account_id == null || account_id === undefined ||
      ("target_date" in b && b.target_date && target_date == null)) {
    return NextResponse.json({ error: "invalid field value" }, { status: 400 });
  }
  db.prepare("UPDATE goals SET name=?, target_amount=?, account_id=?, target_date=?, note=? WHERE id=?")
    .run(name, target, account_id, target_date, "note" in b ? String(b.note ?? "") : before.note, id);
  logActivity(db, "goal", "update", id, `Updated savings goal #${id} ("${name}")`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const id = Number((await params).id);
  const row = db.prepare("SELECT * FROM goals WHERE id=?").get(id) as any;
  if (!row) return NextResponse.json({ ok: true, log_id: null });
  db.prepare("DELETE FROM goals WHERE id=?").run(id);
  const logId = logActivity(db, "goal", "delete", id,
    `Deleted savings goal #${id} ("${row.name}", target ${row.target_amount})`,
    { table: "goals", ...row });
  return NextResponse.json({ ok: true, log_id: logId });
}
