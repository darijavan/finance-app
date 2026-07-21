import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { oneOf } from "@/lib/validate";

export const dynamic = "force-dynamic";

// PUT|DELETE /api/categories/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const id = Number((await params).id);
  const before = db.prepare("SELECT * FROM categories WHERE id=?").get(id) as any;
  if (!before) return NextResponse.json({ error: "category not found" }, { status: 404 });
  const body = await req.json();
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  db.prepare("UPDATE categories SET name=?, color=?, direction=? WHERE id=?")
    .run(name, body.color || before.color, oneOf(body.direction, ["expense", "income"] as const, before.direction), id);
  const row = db.prepare("SELECT * FROM categories WHERE id=?").get(id);
  logActivity(db, "category", "update", id,
    `Updated category #${id} to "${body.name}" (${body.direction})${before ? ` — was "${before.name}"` : ""}`);
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const id = Number((await params).id);
  const row = db.prepare("SELECT * FROM categories WHERE id=?").get(id) as any;
  if (!row) return NextResponse.json({ ok: true, log_id: null });
  db.prepare("DELETE FROM categories WHERE id=?").run(id);
  const logId = logActivity(db, "category", "delete", id,
    `Deleted category #${id} ("${row.name}", ${row.direction})`,
    { table: "categories", ...row });
  return NextResponse.json({ ok: true, log_id: logId });
}
