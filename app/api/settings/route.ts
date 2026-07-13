import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/settings
// PUT /api/settings  body: { currency, currency_symbol }
export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const obj: Record<string, string> = {};
  for (const r of rows) obj[r.key] = r.value;
  return NextResponse.json(obj);
}

export async function PUT(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const upsert = db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  db.exec("BEGIN");
  try {
    for (const [k, v] of Object.entries(body)) upsert.run(k, String(v));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
