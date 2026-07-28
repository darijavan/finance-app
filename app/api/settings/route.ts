import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { currency, SETTINGS_KEYS } from "@/lib/validate";

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
  // Allow-list: only known settings keys may be written.
  const entries = Object.entries(body).filter(([k]) => (SETTINGS_KEYS as readonly string[]).includes(k));
  if (entries.length === 0) 

  return NextResponse.json({ error: "no valid settings keys" }, { status: 400 });
  if ("currency" in body && currency(body.currency) == null) {
    

    return NextResponse.json({ error: "invalid currency code" }, { status: 400 });
  }
  const upsert = db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  db.exec("BEGIN");
  try {
    for (const [k, v] of entries) upsert.run(k, k === "currency" ? currency(v) : String(v));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    

    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  

  return NextResponse.json({ ok: true });
}
