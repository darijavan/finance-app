import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/months  -> distinct YYYY-MM from transactions, newest first (falls back to current month)
export async function GET() {
  const db = getDb();
  const rows = db.prepare("SELECT DISTINCT substr(date,1,7) AS m FROM transactions ORDER BY m DESC").all() as { m: string }[];
  const months = rows.map(r => r.m);
  if (months.length === 0) months.push(new Date().toISOString().slice(0, 7));
  
  return NextResponse.json(months);
}
