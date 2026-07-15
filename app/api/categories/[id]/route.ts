import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

// PUT|DELETE /api/categories/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);
  const before = db.prepare("SELECT * FROM categories WHERE id=?").get(id) as any;
  const body = await req.json();
  db.prepare("UPDATE categories SET name=?, color=?, direction=? WHERE id=?")
    .run(body.name, body.color, body.direction, id);
  const row = db.prepare("SELECT * FROM categories WHERE id=?").get(id);
  logActivity(db, "category", "update", id,
    `Updated category #${id} to "${body.name}" (${body.direction})${before ? ` — was "${before.name}"` : ""}`);
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);
  const row = db.prepare("SELECT * FROM categories WHERE id=?").get(id) as any;
  if (!row) return NextResponse.json({ ok: true, log_id: null });
  db.prepare("DELETE FROM categories WHERE id=?").run(id);
  const logId = logActivity(db, "category", "delete", id,
    `Deleted category #${id} ("${row.name}", ${row.direction})`,
    { table: "categories", ...row });
  return NextResponse.json({ ok: true, log_id: logId });
}
