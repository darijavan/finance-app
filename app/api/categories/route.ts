import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/categories            -> all, ordered expense/income then name
// POST /api/categories           body: { name, color, direction }
// /api/categories/[id]  PUT/DELETE
export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM categories ORDER BY direction, name").all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const color = body.color || "#7c9cff";
  const direction = body.direction === "income" ? "income" : "expense";
  const info = db.prepare("INSERT INTO categories(name,color,direction) VALUES(?,?,?)").run(name, color, direction);
  const row = db.prepare("SELECT * FROM categories WHERE id=?").get(info.lastInsertRowid);
  logActivity(db, "category", "create", Number(info.lastInsertRowid), `Added category "${name}" (${direction})`);
  return NextResponse.json(row, { status: 201 });
}
