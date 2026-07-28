import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { classifyRows, type StatementRow } from "@/lib/statement-import";
import { currency, isoDate, money, oneOf } from "@/lib/validate";

export const dynamic = "force-dynamic";

function validRows(value: unknown): StatementRow[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 1_000) 

  return null;
  const rows: StatementRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") 

    return null;
    const row = item as Record<string, unknown>;
    const date = isoDate(row.date);
    const amount = money(row.amount);
    const note = String(row.note ?? "").trim().slice(0, 500);
    if (!date || !amount) 

    return null;
    rows.push({ date, amount, direction: oneOf(row.direction, ["expense", "income"] as const, "expense"), note });
  }
  

  return rows;
}

export async function GET() {
  const db = getDb();
  const imports = db.prepare(`SELECT i.*, a.name AS account_name,
    COUNT(r.id) AS row_count,
    SUM(r.status='new') AS new_count,
    SUM(r.status='exact_duplicate') AS duplicate_count,
    SUM(r.status='possible_duplicate') AS review_count
    FROM statement_imports i
    JOIN accounts a ON a.id=i.account_id
    LEFT JOIN statement_import_rows r ON r.import_id=i.id
    GROUP BY i.id ORDER BY i.id DESC`).all();
  

  return NextResponse.json(imports);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const accountId = Number(body.account_id);
  const cur = currency(body.currency);
  const source = String(body.source ?? "").trim().slice(0, 128);
  const fingerprint = String(body.source_fingerprint ?? "").trim();
  const rows = validRows(body.rows);
  if (!Number.isInteger(accountId) || accountId <= 0 || !cur || !source || !/^[a-f0-9]{64}$/i.test(fingerprint) || !rows) {
    

    return NextResponse.json({ error: "invalid statement import" }, { status: 400 });
  }

  const db = getDb();
  if (!db.prepare("SELECT 1 FROM accounts WHERE id=?").get(accountId)) {
    

    return NextResponse.json({ error: "account not found" }, { status: 404 });
  }
  const existingImport = db.prepare("SELECT id FROM statement_imports WHERE source_fingerprint=?").get(fingerprint) as { id: number } | undefined;
  if (existingImport) 

  return NextResponse.json({ error: "statement already imported", id: existingImport.id }, { status: 409 });

  const existing = db.prepare("SELECT id,date,amount,direction,note FROM transactions WHERE account_id=?").all(accountId) as Array<StatementRow & { id: number }>;
  const preview = classifyRows(rows, existing);
  const now = new Date().toISOString();
  try {
    db.exec("BEGIN IMMEDIATE");
    const inserted = db.prepare("INSERT INTO statement_imports(source,source_fingerprint,account_id,currency,status,created_at) VALUES(?,?,?,?,?,?)")
      .run(source, fingerprint, accountId, cur, "draft", now);
    const importId = Number(inserted.lastInsertRowid);
    const insertRow = db.prepare(`INSERT INTO statement_import_rows(import_id,row_index,date,amount,direction,note,status,matched_transaction_id,created_at)
      VALUES(?,?,?,?,?,?,?,?,?)`);
    preview.forEach((row, index) => insertRow.run(importId, index, row.date, row.amount, row.direction, row.note, row.status, row.matched_transaction_id, now));
    logActivity(db, "statement_import", "create", importId, `Created statement import draft from ${source} (${rows.length} rows)`);
    db.exec("COMMIT");
    

    return NextResponse.json({ id: importId, rows: preview }, { status: 201 });
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* no transaction to roll back */ }
    

    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
