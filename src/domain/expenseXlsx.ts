import * as XLSX from "xlsx";
import { expenseFingerprint } from "./expenseLedger";

export type ExpenseColumnMapping = {
  date?: number;
  debit?: number;
  credit?: number;
  amount?: number;
  description?: number;
  reference?: number;
};

export type ParsedExpenseRow = {
  id: string;
  date: string;
  amount: number;
  description: string;
  bankReference: string;
  fingerprint: string;
  selected: boolean;
  duplicate?: boolean;
};

export type ExpenseWorkbookPreview = {
  headers: string[];
  rows: unknown[][];
  mapping: ExpenseColumnMapping;
  expenses: ParsedExpenseRow[];
  templateKey: string;
};

const headerText = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const hasHeader = (row: unknown[], ...needles: string[]) =>
  row.some((cell) => needles.some((needle) => headerText(cell).includes(needle)));
const numberValue = (value: unknown) => {
  if (typeof value === "number") return value;
  const text = String(value ?? "").trim();
  if (!text) return 0;
  const cleaned = text.replace(/[^0-9,.-]/g, "");
  if (cleaned.includes(",") && !cleaned.includes(".")) return Number(cleaned.replace(/,/g, "")) || 0;
  return Number(cleaned.replace(/,/g, "")) || 0;
};

export function toExpenseDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  const match = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const iso = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  return iso ? `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}` : "";
}

export function autoMapExpenseColumns(headers: string[]): ExpenseColumnMapping {
  const find = (...needles: string[]) => headers.findIndex((header) => needles.some((needle) => headerText(header).includes(needle)));
  const indexOrUndefined = (index: number) => (index >= 0 ? index : undefined);
  const debit = find("phat sinh no", "ghi no", "debit");
  const credit = find("phat sinh co", "ghi co", "credit");
  return {
    date: indexOrUndefined(find("ngay giao dich", "transaction date", "ngay")),
    debit: indexOrUndefined(debit),
    credit: indexOrUndefined(credit),
    amount: debit >= 0 ? undefined : indexOrUndefined(find("so tien", "amount")),
    description: indexOrUndefined(find("noi dung", "dien giai", "details", "description")),
    reference: indexOrUndefined(find("so but toan", "transaction no", "reference")),
  };
}

export function findExpenseTransactionHeaderRow(rows: unknown[][]) {
  const candidates = rows
    .map((row, index) => {
      const date = hasHeader(row, "ngay giao dich", "transaction date");
      const debit = hasHeader(row, "phat sinh no", "ghi no", "debit");
      const credit = hasHeader(row, "phat sinh co", "ghi co", "credit");
      const description = hasHeader(row, "noi dung", "dien giai", "details", "description");
      const reference = hasHeader(row, "so but toan", "transaction no", "reference");
      return { index, score: Number(date) + Number(debit) + Number(credit) + Number(description) + Number(reference) };
    })
    .filter((candidate) => candidate.score >= 3)
    // MB Bank puts Vietnamese and English header rows next to each other. Prefer
    // the first complete row so the preview uses the visible Vietnamese labels.
    .sort((left, right) => right.score - left.score || left.index - right.index);
  return candidates[0]?.index ?? -1;
}

export function parseExpenseRows(rows: unknown[][], mapping: ExpenseColumnMapping): ParsedExpenseRow[] {
  if (mapping.date === undefined || (mapping.debit === undefined && mapping.amount === undefined)) return [];
  return rows.flatMap((row, index) => {
    const date = toExpenseDate(row[mapping.date!]);
    if (!date) return [];
    const debit = mapping.debit === undefined ? 0 : numberValue(row[mapping.debit]);
    const credit = mapping.credit === undefined ? 0 : numberValue(row[mapping.credit]);
    const signedAmount = mapping.amount === undefined ? 0 : numberValue(row[mapping.amount]);
    const amount = debit > 0 ? debit : signedAmount < 0 ? Math.abs(signedAmount) : 0;
    if (!amount || credit > 0) return [];
    const description = String(mapping.description === undefined ? "" : row[mapping.description] ?? "").trim();
    const bankReference = String(mapping.reference === undefined ? "" : row[mapping.reference] ?? "").trim();
    return [{ id: `row-${index}`, date, amount, description, bankReference, fingerprint: expenseFingerprint({ date, amount, description, bankReference }), selected: true }];
  });
}

export async function readExpenseWorkbook(file: File): Promise<ExpenseWorkbookPreview> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Không tìm thấy trang tính trong file.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  const headerIndex = findExpenseTransactionHeaderRow(rows);
  if (headerIndex < 0) throw new Error("Không xác định được dòng tiêu đề giao dịch.");
  const headers = rows[headerIndex].map((cell) => String(cell ?? "").trim());
  const mapping = autoMapExpenseColumns(headers);
  const dataRows = rows.slice(headerIndex + 1);
  const expenses = parseExpenseRows(dataRows, mapping);
  // v2 intentionally avoids applying mappings saved by the earlier, overly broad Debit/Credit detector.
  const templateKey = headers.some((header) => headerText(header).includes("phat sinh no")) ? "mb-bank-v2" : headers.map(headerText).join("|");
  return { headers, rows: dataRows, mapping, expenses, templateKey };
}
