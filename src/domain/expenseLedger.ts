export type ExpenseSource = "manual" | "xlsx" | "image";
export type ExpensePaymentMethod = "bank" | "cash" | "other";
export type ExpenseStatus = "unclassified" | "classified" | "ignored" | "duplicate";

export type ExpenseTransaction = {
  id: string;
  categoryId: string;
  month: string;
  amount: number;
  date: string;
  note: string;
  source?: ExpenseSource;
  paymentMethod?: ExpensePaymentMethod;
  status?: ExpenseStatus;
  bankReference?: string;
  fingerprint?: string;
  importSessionId?: string;
  confidence?: number;
  createdAt?: string;
  updatedAt?: string;
  meta?: unknown;
};

export type ExpenseCategoryDetails = {
  icon?: string;
  color?: string;
  keywords?: string[];
  isActive?: boolean;
};

export type ExpenseImportSession = {
  id: string;
  source: Extract<ExpenseSource, "xlsx" | "image">;
  fileName: string;
  importedAt: string;
  totalDetected: number;
  totalImported: number;
  totalSkipped: number;
  totalDuplicate: number;
  status: "completed" | "undone";
};

export const EXPENSE_CATEGORY_SEEDS: Array<Required<ExpenseCategoryDetails> & { id: string; name: string }> = [
  { id: "an-uong", name: "Ăn uống", icon: "🍜", color: "#fb923c", keywords: ["FOOD", "CAFE", "RESTAURANT"], isActive: true },
  { id: "xang", name: "Xăng", icon: "⛽", color: "#f59e0b", keywords: ["XANG", "XĂNG", "PETROL", "PVOIL"], isActive: true },
  { id: "bao-duong", name: "Nhớt / Bảo dưỡng", icon: "🔧", color: "#a78bfa", keywords: ["NHOT", "NHỚT", "GARA"], isActive: true },
  { id: "ao-quan", name: "Áo quần", icon: "👕", color: "#ec4899", keywords: ["FASHION", "QUAN", "AO"], isActive: true },
  { id: "mua-sam", name: "Mua sắm", icon: "🛍️", color: "#34d399", keywords: ["LOTTE", "SHOPEE", "MART"], isActive: true },
  { id: "di-lai", name: "Đi lại", icon: "🚌", color: "#60a5fa", keywords: ["GRAB", "BE", "TAXI"], isActive: true },
  { id: "hoc-tap", name: "Học tập", icon: "📚", color: "#38bdf8", keywords: ["HOC", "SACH", "KHÓA HỌC"], isActive: true },
  { id: "hoa-don", name: "Hóa đơn", icon: "🧾", color: "#8b5cf6", keywords: ["DIEN", "NUOC", "INTERNET"], isActive: true },
  { id: "suc-khoe", name: "Sức khỏe", icon: "💚", color: "#22c55e", keywords: ["THUOC", "BENH", "NHA THUOC"], isActive: true },
  { id: "khac", name: "Khác", icon: "◌", color: "#94a3b8", keywords: [], isActive: true },
];

export function normalizedExpenseStatus(entry: Pick<ExpenseTransaction, "categoryId" | "status">): ExpenseStatus {
  return entry.status ?? (entry.categoryId ? "classified" : "unclassified");
}

export function isCountedExpense(entry: Pick<ExpenseTransaction, "status" | "categoryId">) {
  const status = normalizedExpenseStatus(entry);
  return status !== "ignored" && status !== "duplicate";
}

export function normalizeExpenseText(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function expenseFingerprint(input: { date: string; amount: number; description?: string; bankReference?: string }) {
  return [input.date, Math.round(Math.abs(input.amount)), normalizeExpenseText(input.description), normalizeExpenseText(input.bankReference)].join("|");
}

export function suggestExpenseCategory(description: string, categories: Array<{ id: string; keywords?: string[]; name: string }>, history: ExpenseTransaction[]) {
  const normalized = normalizeExpenseText(description);
  if (!normalized) return "";
  const historical = history.find((entry) => entry.categoryId && normalizeExpenseText(entry.note).includes(normalized) && normalized.length >= 4);
  if (historical) return historical.categoryId;
  return categories.find((category) => (category.keywords ?? []).some((keyword) => normalized.includes(normalizeExpenseText(keyword))))?.id ?? "";
}
