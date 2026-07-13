import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// PUT|DELETE /api/categories/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);
  const body = await req.json();
  db.prepare("UPDATE categories SET name=?, color=?, direction=? WHERE id=?")
    .run(body.name, body.color, body.direction, id);
  const row = db.prepare("SELECT * FROM categories WHERE id=?").get(id);
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  db.prepare("DELETE FROM categories WHERE id=?").run(Number(params.id));
  return NextResponse.json({ ok: true });
}
