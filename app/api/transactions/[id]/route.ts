import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// PUT /api/transactions/[id]
// DELETE /api/transactions/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);
  const body = await req.json();
  const fields: string[] = [];
  const args: any[] = [];
  if ("amount" in body) { args.push(Math.abs(Number(body.amount))); fields.push("amount=?"); }
  if ("direction" in body) { args.push(body.direction); fields.push("direction=?"); }
  if ("category_id" in body) { args.push(body.category_id != null ? Number(body.category_id) : null); fields.push("category_id=?"); }
  if ("date" in body) { args.push(body.date); fields.push("date=?"); }
  if ("note" in body) { args.push(body.note); fields.push("note=?"); }
  args.push(id);
  db.prepare(`UPDATE transactions SET ${fields.join(", ")} WHERE id=?`).run(...args);
  const row = db.prepare("SELECT * FROM transactions WHERE id=?").get(id);
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  db.prepare("DELETE FROM transactions WHERE id=?").run(Number(params.id));
  return NextResponse.json({ ok: true });
}
