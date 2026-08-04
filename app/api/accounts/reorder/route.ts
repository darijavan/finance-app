import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ids = (await req.json()).ids;
  if (!Array.isArray(ids) || !ids.every(Number.isInteger)) {

    return NextResponse.json({ error: "ids must be an array of account IDs" }, { status: 400 });
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM accounts ORDER BY id").all() as { id: number }[];
  const requested = [...ids].sort((a, b) => a - b);
  if (existing.length !== requested.length || existing.some((account, index) => account.id !== requested[index])) {

    return NextResponse.json({ error: "account list is out of date" }, { status: 409 });
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const update = db.prepare("UPDATE accounts SET sort_order=? WHERE id=?");
    ids.forEach((id, index) => update.run(index + 1, id));
    db.exec("COMMIT");
  } catch {
    db.exec("ROLLBACK");

    return NextResponse.json({ error: "could not reorder accounts" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
