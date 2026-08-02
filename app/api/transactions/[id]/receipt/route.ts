import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import { getDb, logActivity } from "@/lib/db";
import { receiptDir, receiptName, receiptPath, validReceipt } from "@/lib/receipts";
import { isSubscriptionCharge } from "@/lib/subscription-charge";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const id = Number((await params).id);
  const receipt = db.prepare("SELECT receipt_key, receipt_name, receipt_mime FROM transactions WHERE id=?").get(id) as any;
  if (!receipt?.receipt_key)

  return NextResponse.json({ error: "receipt not found" }, { status: 404 });
  try {
    const body = await fs.readFile(receiptPath(receipt.receipt_key));

    return new NextResponse(body, {
      headers: {
        "Content-Type": receipt.receipt_mime,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(receiptName(receipt.receipt_name || "receipt"))}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {

    return NextResponse.json({ error: "receipt not found" }, { status: 404 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const id = Number((await params).id);
  const transaction = db.prepare("SELECT receipt_key, receipt_name, subscription_id FROM transactions WHERE id=?").get(id) as any;
  if (!transaction)

  return NextResponse.json({ error: "transaction not found" }, { status: 404 });
  if (isSubscriptionCharge(transaction))

  return NextResponse.json({ error: "subscription charges are read-only" }, { status: 409 });
  const form = await req.formData();
  const receipt = form.get("receipt");
  if (!(receipt instanceof File) || !validReceipt(receipt)) {

    return NextResponse.json({ error: "receipt must be a PDF, JPEG, PNG, or WebP up to 10 MB" }, { status: 400 });
  }
  const key = randomUUID();
  const target = receiptPath(key);
  await fs.mkdir(receiptDir(), { recursive: true });
  try {
    await fs.writeFile(target, Buffer.from(await receipt.arrayBuffer()), { flag: "wx" });
    db.prepare("UPDATE transactions SET receipt_key=?, receipt_name=?, receipt_mime=? WHERE id=?")
      .run(key, receiptName(receipt.name), receipt.type, id);
  } catch (error) {
    await fs.rm(target, { force: true });

    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
  if (transaction.receipt_key) await fs.rm(receiptPath(transaction.receipt_key), { force: true });
  logActivity(db, "transaction", "update", id, `Attached receipt to transaction #${id}`);

  return NextResponse.json({ ok: true, name: receiptName(receipt.name) });
}
