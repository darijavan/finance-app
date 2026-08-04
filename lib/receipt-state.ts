export function withReceiptName<T extends { id: number; receipt_name: string | null }>(rows: T[], id: number, receiptName: string): T[] {

  return rows.map((row) => row.id === id ? { ...row, receipt_name: receiptName } : row);
}
