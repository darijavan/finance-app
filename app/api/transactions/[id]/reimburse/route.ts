import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { isSubscriptionCharge } from "@/lib/subscription-charge";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const id = Number((await params).id);
  const transaction = db.prepare("SELECT reimbursable, reimbursed_at, subscription_id FROM transactions WHERE id=?").get(id) as any;
  if (!transaction)

  return NextResponse.json({ error: "transaction not found" }, { status: 404 });
  if (isSubscriptionCharge(transaction))

  return NextResponse.json({ error: "subscription charges are read-only" }, { status: 409 });
  if (!transaction.reimbursable)

  return NextResponse.json({ error: "transaction is not reimbursable" }, { status: 409 });
  if (transaction.reimbursed_at)

  return NextResponse.json({ error: "transaction is already reimbursed" }, { status: 409 });
  const reimbursedAt = new Date().toISOString();
  db.prepare("UPDATE transactions SET reimbursed_at=? WHERE id=?").run(reimbursedAt, id);
  logActivity(db, "transaction", "update", id, `Marked transaction #${id} reimbursed`);

  return NextResponse.json({ ok: true, reimbursed_at: reimbursedAt });
}
