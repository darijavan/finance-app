import { NextRequest, NextResponse } from "next/server";
import { getConverter, refreshRates } from "@/lib/fx";

export const dynamic = "force-dynamic";

// GET /api/fx           -> { base, rates } (auto-refreshes if stale)
// POST /api/fx?force=1  -> force refresh from the upstream API
export async function GET() {
  const { base, rates } = await getConverter();
  

  return NextResponse.json({ base, rates });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") != null;
  const rates = await refreshRates(force);
  

  return NextResponse.json({ ok: true, rates });
}
