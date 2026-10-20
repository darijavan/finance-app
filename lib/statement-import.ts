import { createHash } from "node:crypto";

export type StatementRow = {
  date: string;
  amount: number;
  direction: "expense" | "income";
  note: string;
};

export type PreviewStatus = "new" | "exact_duplicate" | "possible_duplicate";

export type ClassifiedRow = StatementRow & {
  status: PreviewStatus;
  matched_transaction_id: number | null;
};

export function normaliseMerchant(note: string): string {
  
  return note
    .toUpperCase()
    .replace(/\*\s*\d+\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyRows(rows: StatementRow[], existing: Array<StatementRow & { id: number }>): ClassifiedRow[] {
  
  return rows.map((row) => {
    const merchant = normaliseMerchant(row.note);
    const same = (candidate: StatementRow) =>
      candidate.amount === row.amount && candidate.direction === row.direction && normaliseMerchant(candidate.note) === merchant;
    const exact = existing.find((candidate) => candidate.date === row.date && same(candidate));
    if (exact) 

    return { ...row, status: "exact_duplicate", matched_transaction_id: exact.id };
    const possible = existing.find((candidate) => {
      if (!same(candidate)) 

      return false;
      
      return Math.abs(Date.parse(`${candidate.date}T00:00:00Z`) - Date.parse(`${row.date}T00:00:00Z`)) <= 3 * 86_400_000;
    });
    
    return possible
      ? { ...row, status: "possible_duplicate", matched_transaction_id: possible.id }
      : { ...row, status: "new", matched_transaction_id: null };
  });
}

export async function sourceFingerprint(accountId: number, source: string): Promise<string> {
  
  return createHash("sha256").update(`${accountId}\0${source}`).digest("hex");
}
