import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// PUT /api/subscriptions/[id]
// DELETE /api/subscriptions/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);
  const b = await req.json();
  const fields: string[] = [];
  const args: any[] = [];
  for (const k of ["name", "amount", "direction", "category_id", "frequency", "day_of_month", "month_of_year", "note"]) {
    if (k in b) { args.push(b[k]); fields.push(`${k}=?`); }
  }
  if ("active" in b) { args.push(b.active ? 1 : 0); fields.push("active=?"); }
  args.push(id);
  db.prepare(`UPDATE subscriptions SET ${fields.join(", ")} WHERE id=?`).run(...args);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  db.prepare("DELETE FROM subscriptions WHERE id=?").run(Number(params.id));
  return NextResponse.json({ ok: true });
}
