import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

// DELETE /api/accounts/[id]  -> removes account (only if no linked rows, else 409)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const id = Number((await params).id);
  const row = db.prepare("SELECT * FROM accounts WHERE id=?").get(id) as any;
  if (!row) 

  return NextResponse.json({ ok: true, log_id: null });

  const linked =
    (db.prepare("SELECT COUNT(*) AS c FROM transactions WHERE account_id=?").get(id) as any).c +
    (db.prepare("SELECT COUNT(*) AS c FROM transfers WHERE from_account=? OR to_account=?").get(id, id) as any).c +
    (db.prepare("SELECT COUNT(*) AS c FROM subscriptions WHERE account_id=?").get(id) as any).c;
  if (linked > 0) {
    

    return NextResponse.json(
      { error: "Account is in use by transactions, transfers, or subscriptions. Reassign or delete those first." },
      { status: 409 },
    );
  }

  db.prepare("DELETE FROM accounts WHERE id=?").run(id);
  const logId = logActivity(db, "account", "delete", id,
    `Deleted account #${id} ("${row.name}")`,
    { table: "accounts", ...row });
  

  return NextResponse.json({ ok: true, log_id: logId });
}
