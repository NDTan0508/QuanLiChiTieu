import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownCircle,
  BadgeDollarSign,
  BarChart3,
  Bitcoin,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Coins,
  Pencil,
  Landmark,
  LayoutDashboard,
  LineChart,
  Lock,
  PiggyBank,
  Plus,
  Save,
  Settings,
  X,
} from "lucide-react";
import { deleteCloudState, isCloudSyncConfigured, loadAdminPasswordHash, loadCloudState, saveCloudState } from "./cloudSync";

type Page =
  | "dashboard"
  | "investment"
  | "mbb"
  | "reports";

type IncomeCategory = {
  id: string;
  name: string;
  kind: "fixed" | "variable";
};

type IncomeTransaction = {
  id: string;
  categoryId: string;
  amount: number;
  date: string;
  month: string;
  note: string;
};

type ExpenseCategory = {
  id: string;
  name: string;
  kind: "fixed" | "variable";
  defaultAmount: number;
};

type MonthlyExpense = {
  id: string;
  categoryId: string;
  month: string;
  startAmount: number;
  endAmount: number;
  amount: number;
  checked: boolean;
};

type ExpenseEntry = {
  id: string;
  categoryId: string;
  month: string;
  amount: number;
  date: string;
  note: string;
};

type Allocation = {
  month: string;
  btcPercent: number;
  stockPercent: number;
  savingPercent: number;
  emergencyPercent: number;
  confirmedAt?: string;
  btcAmount?: number;
  stockAmount?: number;
  savingAmount?: number;
  emergencyAmount?: number;
  totalSavingAtConfirm?: number;
  savingDepositRequestedAt?: string;
  emergencyDepositRequestedAt?: string;
  savingDepositCreatedAt?: string;
  emergencyDepositCreatedAt?: string;
};

type FundKey = "btc" | "stock";
type InvestmentTab = FundKey | "sol";

type FundTransaction = {
  id: string;
  fund: FundKey;
  type: "deposit" | "withdraw";
  amount: number;
  date: string;
  month: string;
  note: string;
};

type DepositFund = "saving" | "emergency";
type DepositFilter = "all" | DepositFund;
type DepositStatus =
  | "active"
  | "rolled-principal"
  | "rolled-all"
  | "settled"
  | "early-settled";

type BankDeposit = {
  id: string;
  code: string;
  fund: DepositFund;
  mbLast4: string;
  principal: number;
  rate: number;
  termMonths: number;
  startDate: string;
  maturityDate: string;
  status: DepositStatus;
  parentId?: string;
  childId?: string;
  createdFromMonth?: string;
  settledAt?: string;
  settledAmount?: number;
  note: string;
};

type AllocationAmounts = {
  btc: number;
  stock: number;
  saving: number;
  emergency: number;
  savingRemainder: number;
  emergencyRemainder: number;
};

type AllocationPercentKey = "btcPercent" | "stockPercent" | "savingPercent" | "emergencyPercent";
type AllocationAmountKey = "btcAmount" | "stockAmount" | "savingAmount" | "emergencyAmount";

type IncomeSummaryRow = {
  id: string;
  name: string;
  value: number;
  transactions: IncomeTransaction[];
};

type ExpenseSummaryRow = {
  id: string;
  name: string;
  value: number;
  transactions: ExpenseEntry[];
  kind: ExpenseCategory['kind'];
};

type SolTransaction = {
  id: string;
  solAmount: number;
  buyPrice: number;
  date: string;
  note: string;
};

type Market = {
  solUsd: number;
  usdVnd: number;
  updatedAt: string;
};

type SettingsState = {
  pin: string;
  hasPin: boolean;
};

type AppState = {
  incomeCategories: IncomeCategory[];
  incomeTransactions: IncomeTransaction[];
  expenseCategories: ExpenseCategory[];
  monthlyExpenses: MonthlyExpense[];
  expenseEntries: ExpenseEntry[];
  allocations: Allocation[];
  fundTransactions: FundTransaction[];
  bankDeposits: BankDeposit[];
  solTransactions: SolTransaction[];
  market: Market;
  settings: SettingsState;
};

const STORAGE_KEY = "quan-li-chi-tieu-state-v3-account-pin-reset";
const CLOUD_ACCOUNT_NAMESPACE = "quan-li-chi-tieu-account-pin-reset-v1";
const DEFAULT_ADMIN_PASSWORD_HASH = "83e9887aca4b4c1d7b8688d6392c5f20c77a1dc405c3d5406918c46c68da6063";
const DEFAULT_START_MONTH = "2026-06";
const CERTIFICATE_LOT = 100_000;
const COLORS = ["#f97316", "#14b8a6", "#eab308", "#60a5fa", "#f43f5e", "#a78bfa"];

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const monthFromDate = (value: string) => value.slice(0, 7);

const addMonths = (dateValue: string, months: number) => {
  const date = new Date(`${dateValue}T00:00:00`);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== day) date.setDate(0);
  return date.toISOString().slice(0, 10);
};

const daysUntil = (dateValue: string) => {
  const now = new Date(`${today()}T00:00:00`).getTime();
  const target = new Date(`${dateValue}T00:00:00`).getTime();
  return Math.ceil((target - now) / 86_400_000);
};

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const formatMonth = (value: string) => {
  const [year, month] = value.split("-");
  return `${month}/${year}`;
};

const shiftMonth = (value: string, delta: number) => {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const formatVnd = (value: number) =>
  `${Math.round(value).toLocaleString("vi-VN")}đ`;

const formatUsd = (value: number) =>
  `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT`;

const parseMoney = (value: string) => Number(value.replace(/[^\d]/g, "")) || 0;
const cloudAccountKeyForPin = (pin: string) => `${CLOUD_ACCOUNT_NAMESPACE}:${pin}`;
const stateForAccountPin = (state: AppState, pin: string): AppState => ({
  ...state,
  settings: { hasPin: true, pin },
});
const sha256Hex = async (value: string) => {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const interestFor = (deposit: Pick<BankDeposit, "principal" | "rate" | "termMonths">) =>
  Math.round((deposit.principal * deposit.rate * deposit.termMonths) / 100 / 12);

const roundDownToCertificateLot = (amount: number) =>
  Math.floor(Math.max(amount, 0) / CERTIFICATE_LOT) * CERTIFICATE_LOT;

const allocationAmountOrDefault = (amount: number | undefined, fallback: number) =>
  typeof amount === "number" && Number.isFinite(amount) ? Math.max(amount, 0) : fallback;

function normalizeState(state: AppState): AppState {
  const expenseCategories = state.expenseCategories.map((category: ExpenseCategory & { kind?: string }) => {
    const migratedKind: ExpenseCategory["kind"] = category.kind === "variable" ? "variable" : "fixed";
    if (category.id === "chi-tieu") {
      return { ...category, kind: "fixed" as const, defaultAmount: category.defaultAmount || 3_000_000 };
    }
    if (category.id === "phat-sinh") {
      return { ...category, kind: "variable" as const, defaultAmount: 0 };
    }
    return { ...category, kind: migratedKind, defaultAmount: category.defaultAmount ?? 0 };
  });

  const bankDeposits = state.bankDeposits.map((deposit) => ({
    ...deposit,
    mbLast4: deposit.mbLast4 ?? "",
  }));

  return {
    ...state,
    expenseCategories,
    bankDeposits,
  };
}

function calculateAllocationAmounts(totalSaving: number, allocation: Allocation): AllocationAmounts {
  const total = Math.max(totalSaving, 0);
  const rawBtc = (total * allocation.btcPercent) / 100;
  const rawStock = (total * allocation.stockPercent) / 100;
  const rawSaving = (total * allocation.savingPercent) / 100;
  const rawEmergency = (total * allocation.emergencyPercent) / 100;
  const saving = roundDownToCertificateLot(rawSaving);
  const emergency = roundDownToCertificateLot(rawEmergency);
  const savingRemainder = rawSaving - saving;
  const emergencyRemainder = rawEmergency - emergency;

  return {
    btc: allocationAmountOrDefault(allocation.btcAmount, rawBtc + savingRemainder + emergencyRemainder),
    stock: allocationAmountOrDefault(allocation.stockAmount, rawStock),
    saving: allocationAmountOrDefault(allocation.savingAmount, saving),
    emergency: allocationAmountOrDefault(allocation.emergencyAmount, emergency),
    savingRemainder,
    emergencyRemainder,
  };
}

const initialState: AppState = {
  incomeCategories: [
    { id: "pt-valley", name: "PT Valley", kind: "fixed" },
    { id: "fishing", name: "Fishing", kind: "variable" },
    { id: "other-income", name: "Thu nhập khác", kind: "variable" },
  ],
  incomeTransactions: [],
  expenseCategories: [
    { id: "chi-tieu", name: "Chi tiêu", kind: "fixed", defaultAmount: 3000000 },
    { id: "phat-sinh", name: "Phát sinh", kind: "variable", defaultAmount: 0 },
    { id: "me", name: "Mẹ", kind: "fixed", defaultAmount: 3000000 },
    { id: "du-lich", name: "Du lịch", kind: "fixed", defaultAmount: 1500000 },
    { id: "hoc-phi", name: "Học phí", kind: "fixed", defaultAmount: 2000000 },
  ],
  monthlyExpenses: [],
  expenseEntries: [],
  allocations: [
    {
      month: DEFAULT_START_MONTH,
      btcPercent: 20,
      stockPercent: 20,
      savingPercent: 40,
      emergencyPercent: 20,
    },
  ],
  fundTransactions: [],
  bankDeposits: [],
  solTransactions: [],
  market: {
    solUsd: 0,
    usdVnd: 0,
    updatedAt: "",
  },
  settings: {
    pin: "",
    hasPin: false,
  },
};

function useStoredState() {
  const [state, setState] = useState<AppState>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    try {
      return normalizeState({ ...initialState, ...JSON.parse(raw) });
    } catch {
      return initialState;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return [state, setState] as const;
}

function getAllocation(state: AppState, month: string): Allocation {
  return (
    state.allocations.find((item) => item.month === month) ?? {
      month,
      btcPercent: 20,
      stockPercent: 20,
      savingPercent: 40,
      emergencyPercent: 20,
    }
  );
}

function getMonthlyExpense(state: AppState, category: ExpenseCategory, month: string): MonthlyExpense {
  return (
    state.monthlyExpenses.find((item) => item.categoryId === category.id && item.month === month) ?? {
      id: uid(),
      categoryId: category.id,
      month,
      startAmount: 0,
      endAmount: 0,
      amount: category.defaultAmount,
      checked: false,
    }
  );
}

function monthlySummary(state: AppState, month: string) {
  const incomeRows: IncomeSummaryRow[] = state.incomeCategories.map((category) => {
    const transactions = state.incomeTransactions
      .filter((item) => item.month === month && item.categoryId === category.id)
      .sort((left, right) => right.date.localeCompare(left.date));
    const total = transactions.reduce((sum, item) => sum + item.amount, 0);
    return { id: category.id, name: category.name, value: total, transactions };
  });

  const expenseRows: ExpenseSummaryRow[] = state.expenseCategories.map((category) => {
    const record = getMonthlyExpense(state, category, month);
    const transactions = state.expenseEntries
      .filter((item) => item.month === month && item.categoryId === category.id)
      .sort((left, right) => right.date.localeCompare(left.date));
    const entries = transactions.reduce((sum, item) => sum + item.amount, 0);
    const base = category.kind === "fixed" && record.checked ? record.amount : 0;
    return {
      id: category.id,
      name: category.name,
      value: base + entries,
      transactions,
      kind: category.kind,
    };
  });

  const income = incomeRows.reduce((sum, item) => sum + item.value, 0);
  const expense = expenseRows.reduce((sum, item) => sum + item.value, 0);
  const saving = income - expense;
  const allocation = getAllocation(state, month);
  const allocationAmounts = calculateAllocationAmounts(saving, allocation);

  return { incomeRows, expenseRows, income, expense, saving, allocation, allocationAmounts };
}

function activePrincipal(deposit: BankDeposit) {
  if (deposit.status === "active") return deposit.principal;
  return 0;
}

const depositCreatedField = (fund: DepositFund) =>
  fund === "saving" ? "savingDepositCreatedAt" : "emergencyDepositCreatedAt";
const depositRequestedField = (fund: DepositFund) =>
  fund === "saving" ? "savingDepositRequestedAt" : "emergencyDepositRequestedAt";

function AppNav({
  page,
  setPage,
}: {
  page: Page;
  setPage: (page: Page) => void;
}) {
  const items: Array<{ id: Page; label: string; icon: JSX.Element }> = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { id: "investment", label: "Đầu tư", icon: <LineChart size={18} /> },
    { id: "mbb", label: "Sổ MBB", icon: <Landmark size={18} /> },
    { id: "reports", label: "Báo cáo", icon: <BarChart3 size={18} /> },
  ];

  return (
    <nav className="app-nav">
      <div className="brand">
        <span className="brand-mark">Q</span>
        <div>
          <strong>Quản Lí</strong>
          <small>Chi tiêu cá nhân</small>
        </div>
      </div>
      <div className="nav-list">
        {items.map((item) => (
          <button
            className={page === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setPage(item.id)}
            title={item.label}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function PinGate({
  state,
  setState,
  cloudConfigured,
  onUnlock,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  cloudConfigured: boolean;
  onUnlock: (pin: string) => Promise<string | null>;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSetup = !state.settings.hasPin;

  const submit = async () => {
    if (pin.length < 4) {
      setError("PIN cần tối thiểu 4 số.");
      return;
    }
    if (cloudConfigured) {
      setLoading(true);
      setError("");
      const loginError = await onUnlock(pin);
      setLoading(false);
      if (loginError) setError(loginError);
      return;
    }
    if (isSetup) {
      setState((prev) => ({ ...prev, settings: { pin, hasPin: true } }));
      await onUnlock(pin);
      return;
    }
    if (pin === state.settings.pin) await onUnlock(pin);
    else setError("PIN chưa đúng.");
  };

  return (
    <main className="pin-screen">
      <section className="pin-card">
        <div className="pin-icon">
          <Lock size={26} />
        </div>
        <h1>Nhập mã PIN</h1>
        <p>Mở dữ liệu tài khoản của bạn. Tạo hoặc đổi PIN tại /admin.</p>
        <input
          inputMode="numeric"
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
          placeholder="Nhập PIN"
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
        {error && <span className="form-error">{error}</span>}
        <button className="primary full" disabled={loading} onClick={submit}>
          {loading ? "Đang mở..." : "Mở app"}
        </button>
        <a className="admin-link" href="/admin">Tạo hoặc đổi PIN</a>
      </section>
    </main>
  );
}

function MonthPicker({ month, setMonth }: { month: string; setMonth: (month: string) => void }) {
  return (
    <div className="month-picker">
      <button title="Tháng trước" onClick={() => setMonth(shiftMonth(month, -1))}>
        <ChevronLeft size={18} />
      </button>
      <input
        className="month-picker-input"
        type="month"
        value={month}
        onChange={(event) => {
          if (event.target.value) setMonth(event.target.value);
        }}
        aria-label="Chọn tháng"
      />
      <strong>Tháng {formatMonth(month)}</strong>
      <button title="Tháng sau" onClick={() => setMonth(shiftMonth(month, 1))}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subValue,
  icon,
  tone,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon: JSX.Element;
  tone?: string;
}) {
  return (
    <article className={`metric ${tone ?? ""}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {subValue && <em>{subValue}</em>}
      </div>
    </article>
  );
}

function BreakdownPie({ data }: { data: Array<{ name: string; value: number }> }) {
  const rows = data.filter((item) => item.value > 0);
  if (rows.length === 0) return <div className="empty-chart">Chưa có dữ liệu</div>;
  return (
    <ResponsiveContainer width="100%" height={210}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3}>
          {rows.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatVnd(Number(value))} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function DashboardPage({
  state,
  month,
  setMonth,
  setPage,
}: {
  state: AppState;
  month: string;
  setMonth: (month: string) => void;
  setPage: (page: Page) => void;
}) {
  const summary = monthlySummary(state, month);
  const [selectedIncomeId, setSelectedIncomeId] = useState<string | null>(null);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const dueSoon = state.bankDeposits
    .filter((item) => item.status === "active")
    .map((item) => ({ ...item, dueDays: daysUntil(item.maturityDate) }))
    .filter((item) => item.dueDays <= 30)
    .sort((a, b) => a.dueDays - b.dueDays)
    .slice(0, 3);

  useEffect(() => {
    setSelectedIncomeId((current) => {
      if (current && summary.incomeRows.some((row) => row.id === current)) return current;
      return summary.incomeRows.find((row) => row.value > 0)?.id ?? summary.incomeRows[0]?.id ?? null;
    });
    setSelectedExpenseId((current) => {
      if (current && summary.expenseRows.some((row) => row.id === current)) return current;
      return summary.expenseRows.find((row) => row.id === "phat-sinh" && row.value > 0)?.id ?? summary.expenseRows.find((row) => row.value > 0)?.id ?? summary.expenseRows[0]?.id ?? null;
    });
  }, [month, summary.expenseRows, summary.incomeRows]);

  const selectedIncome = summary.incomeRows.find((row) => row.id === selectedIncomeId) ?? null;
  const selectedExpense = summary.expenseRows.find((row) => row.id === selectedExpenseId) ?? null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Tháng {formatMonth(month)}</h1>
        </div>
        <MonthPicker month={month} setMonth={setMonth} />
      </header>

      <section className="metrics-grid">
        <MetricCard label="Thu nhập" value={formatVnd(summary.income)} icon={<BadgeDollarSign size={20} />} />
        <MetricCard label="Chi tiêu" value={formatVnd(summary.expense)} icon={<ArrowDownCircle size={20} />} />
        <MetricCard label="Tiết kiệm tháng" value={formatVnd(summary.saving)} icon={<PiggyBank size={20} />} tone="highlight" />
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel-title">
            <h2>Thu nhập</h2>
            <strong>{formatVnd(summary.income)}</strong>
          </div>
          <BreakdownPie data={summary.incomeRows} />
          <DetailList rows={summary.incomeRows} selectedId={selectedIncomeId} onSelect={setSelectedIncomeId} />
          <CategoryHistoryPanel
            title={selectedIncome?.name ?? "Thu nhập"}
            rows={selectedIncome?.transactions ?? []}
            emptyText="Chưa có khoản thu nào trong tháng này."
            itemTone="income"
          />
        </article>
        <article className="panel">
          <div className="panel-title">
            <h2>Chi tiêu</h2>
            <strong>{formatVnd(summary.expense)}</strong>
          </div>
          <BreakdownPie data={summary.expenseRows} />
          <DetailList rows={summary.expenseRows} selectedId={selectedExpenseId} onSelect={setSelectedExpenseId} />
          <CategoryHistoryPanel
            title={selectedExpense?.name ?? "Chi tiêu"}
            rows={selectedExpense?.transactions ?? []}
            emptyText="Chưa có khoản phát sinh nào trong tháng này."
            itemTone="expense"
          />
        </article>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Tiền được chia</h2>
          <button className="ghost" onClick={() => setPage("dashboard")}>
            Chỉnh
          </button>
        </div>
        <div className="allocation-grid">
          <FundChip label="BTC" value={summary.allocationAmounts.btc} percent={summary.allocation.btcPercent} />
          <FundChip label="CK" value={summary.allocationAmounts.stock} percent={summary.allocation.stockPercent} />
          <FundChip label="Quỹ tiết kiệm" value={summary.allocationAmounts.saving} percent={summary.allocation.savingPercent} />
          <FundChip label="Dự phòng" value={summary.allocationAmounts.emergency} percent={summary.allocation.emergencyPercent} />
        </div>
      </section>

      <section className="two-column compact">
        <article className="panel">
          <div className="panel-title">
            <h2>Checklist</h2>
            <small>Tick mới tính vào chi tiêu</small>
          </div>
          <div className="check-list">
            {state.expenseCategories
              .filter((category) => category.kind === "fixed")
              .map((category) => {
                const record = getMonthlyExpense(state, category, month);
                return (
                  <div key={category.id} className={record.checked ? "done" : ""}>
                    <CheckCircle2 size={18} />
                    <span>Chuyển {category.name}</span>
                    <strong>{formatVnd(record.amount)}</strong>
                  </div>
                );
              })}
          </div>
        </article>

        <article className="panel">
          <div className="panel-title">
            <h2>Sổ sắp đáo hạn</h2>
            <button className="ghost" onClick={() => setPage("mbb")}>
              Xem
            </button>
          </div>
          {dueSoon.length === 0 ? (
            <p className="muted">Chưa có sổ nào cần xử lý trong 30 ngày tới.</p>
          ) : (
            <div className="deposit-mini-list">
              {dueSoon.map((item) => (
                <div className={item.dueDays <= 7 ? "danger" : "warning"} key={item.id}>
                  <CalendarClock size={18} />
                  <span>{item.fund === "saving" ? "Quỹ tiết kiệm" : "Quỹ dự phòng"}</span>
                  <strong>{formatVnd(item.principal)}</strong>
                  <small>{item.dueDays <= 0 ? "Đã đáo hạn" : `${item.dueDays} ngày nữa`}</small>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

type NewExpenseKind = Exclude<ExpenseCategory["kind"], "envelope">;

function UnifiedDashboardPage({
  state,
  setState,
  month,
  setMonth,
  setPage,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  month: string;
  setMonth: (month: string) => void;
  setPage: (page: Page) => void;
}) {
  const summary = monthlySummary(state, month);
  const [selectedIncomeId, setSelectedIncomeId] = useState<string | null>(null);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [entryModal, setEntryModal] = useState<"income" | "expense" | null>(null);
  const [showNewIncomeCategory, setShowNewIncomeCategory] = useState(false);
  const [showNewExpenseCategory, setShowNewExpenseCategory] = useState(false);
  const [allocationEditing, setAllocationEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [allocationAmountInputs, setAllocationAmountInputs] = useState<Partial<Record<AllocationAmountKey, string>>>({});
  const [editingFixed, setEditingFixed] = useState<{ categoryId: string; amount: string } | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<
    | { kind: "income"; id: string; categoryId: string; amount: string; date: string; note: string }
    | { kind: "expense"; id: string; categoryId: string; amount: string; date: string; note: string }
    | null
  >(null);
  const [incomeForm, setIncomeForm] = useState({
    categoryId: state.incomeCategories.find((category) => category.id === "other-income")?.id ?? state.incomeCategories[0]?.id ?? "",
    amount: "",
    date: today(),
    note: "",
  });
  const [expenseEntry, setExpenseEntry] = useState({
    categoryId: state.expenseCategories.find((category) => category.id === "phat-sinh")?.id ?? state.expenseCategories[0]?.id ?? "",
    amount: "",
    date: today(),
    note: "",
  });
  const [newIncome, setNewIncome] = useState({ name: "", kind: "variable" as IncomeCategory["kind"] });
  const [newExpense, setNewExpense] = useState({ name: "", kind: "variable" as NewExpenseKind, amount: "" });
  const [depositForm, setDepositForm] = useState({ month, note: "Chia quỹ cuối tháng" });

  useEffect(() => {
    setDepositForm((prev) => (prev.month === month ? prev : { ...prev, month }));
    setAllocationAmountInputs({});
  }, [month]);

  useEffect(() => {
    setSelectedIncomeId((current) => {
      if (current && summary.incomeRows.some((row) => row.id === current)) return current;
      return summary.incomeRows.find((row) => row.value > 0)?.id ?? summary.incomeRows[0]?.id ?? null;
    });
    setSelectedExpenseId((current) => {
      if (current && summary.expenseRows.some((row) => row.id === current)) return current;
      return summary.expenseRows.find((row) => row.id === "phat-sinh" && row.value > 0)?.id ?? summary.expenseRows.find((row) => row.value > 0)?.id ?? summary.expenseRows[0]?.id ?? null;
    });
  }, [month, summary.expenseRows, summary.incomeRows]);

  const dueSoon = state.bankDeposits
    .filter((item) => item.status === "active")
    .map((item) => ({ ...item, dueDays: daysUntil(item.maturityDate) }))
    .filter((item) => item.dueDays <= 30)
    .sort((a, b) => a.dueDays - b.dueDays)
    .slice(0, 3);
  const selectedIncome = summary.incomeRows.find((row) => row.id === selectedIncomeId) ?? null;
  const selectedExpense = summary.expenseRows.find((row) => row.id === selectedExpenseId) ?? null;
  const fixedCategories = state.expenseCategories.filter((category) => category.kind === "fixed");
  const percentTotal =
    summary.allocation.btcPercent +
    summary.allocation.stockPercent +
    summary.allocation.savingPercent +
    summary.allocation.emergencyPercent;
  const allocationAmountRows: Array<{ percentKey: AllocationPercentKey; amountKey: AllocationAmountKey; label: string; amount: number }> = [
    { percentKey: "btcPercent", amountKey: "btcAmount", label: "BTC", amount: summary.allocationAmounts.btc },
    { percentKey: "stockPercent", amountKey: "stockAmount", label: "CK", amount: summary.allocationAmounts.stock },
    { percentKey: "savingPercent", amountKey: "savingAmount", label: "Quỹ tiết kiệm", amount: summary.allocationAmounts.saving },
    { percentKey: "emergencyPercent", amountKey: "emergencyAmount", label: "Dự phòng", amount: summary.allocationAmounts.emergency },
  ];
  const allocationAmountTotal = allocationAmountRows.reduce((sum, item) => sum + Math.round(item.amount), 0);
  const availableAllocationAmount = Math.round(Math.max(summary.saving, 0));
  const amountTotalMatchesSaving = Math.abs(allocationAmountTotal - availableAllocationAmount) <= 1;
  const hasCustomAllocationAmounts = allocationAmountRows.some((item) => typeof summary.allocation[item.amountKey] === "number");
  const monthAlreadyConfirmed = Boolean(summary.allocation.confirmedAt);

  const updateMonthlyExpense = (category: ExpenseCategory, patch: Partial<MonthlyExpense>) => {
    setState((prev) => {
      const existing = prev.monthlyExpenses.find((item) => item.categoryId === category.id && item.month === month);
      const next = existing ? { ...existing, ...patch } : { ...getMonthlyExpense(prev, category, month), ...patch };
      return {
        ...prev,
        monthlyExpenses: existing ? prev.monthlyExpenses.map((item) => (item.id === existing.id ? next : item)) : [...prev.monthlyExpenses, next],
      };
    });
  };

  const updateAllocation = (patch: Partial<Allocation>) => {
    setState((prev) => {
      const existing = prev.allocations.find((item) => item.month === month);
      const next = { ...getAllocation(prev, month), ...patch };
      return {
        ...prev,
        allocations: existing ? prev.allocations.map((item) => (item.month === month ? next : item)) : [...prev.allocations, next],
      };
    });
  };

  const updateAllocationAmount = (key: AllocationAmountKey, value: string) => {
    setAllocationAmountInputs((prev) => ({ ...prev, [key]: value }));
    updateAllocation({ [key]: value.trim() === "" ? undefined : parseMoney(value) } as Partial<Allocation>);
  };

  const commitAllocationAmount = (key: AllocationAmountKey) => {
    setAllocationAmountInputs((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      const value = next[key] ?? "";
      if (value.trim() === "") delete next[key];
      else next[key] = parseMoney(value).toLocaleString("vi-VN");
      return next;
    });
  };

  const addIncome = () => {
    const amount = parseMoney(incomeForm.amount);
    if (!amount || !incomeForm.categoryId || !incomeForm.date) return;
    setState((prev) => ({
      ...prev,
      incomeTransactions: [...prev.incomeTransactions, { id: uid(), categoryId: incomeForm.categoryId, amount, date: incomeForm.date, month: monthFromDate(incomeForm.date), note: incomeForm.note }],
    }));
    setSelectedIncomeId(incomeForm.categoryId);
    setIncomeForm((prev) => ({ ...prev, amount: "", note: "" }));
    setEntryModal(null);
  };

  const addExpenseEntry = () => {
    const amount = parseMoney(expenseEntry.amount);
    if (!amount || !expenseEntry.categoryId || !expenseEntry.date) return;
    setState((prev) => ({
      ...prev,
      expenseEntries: [...prev.expenseEntries, { id: uid(), categoryId: expenseEntry.categoryId, amount, date: expenseEntry.date, month: monthFromDate(expenseEntry.date), note: expenseEntry.note }],
    }));
    setSelectedExpenseId(expenseEntry.categoryId);
    setExpenseEntry((prev) => ({ ...prev, amount: "", note: "" }));
    setEntryModal(null);
  };

  const addIncomeCategory = () => {
    if (!newIncome.name.trim()) return;
    const category = { id: uid(), name: newIncome.name.trim(), kind: newIncome.kind };
    setState((prev) => ({ ...prev, incomeCategories: [...prev.incomeCategories, category] }));
    setIncomeForm((prev) => ({ ...prev, categoryId: category.id }));
    setNewIncome({ name: "", kind: "variable" });
    setShowNewIncomeCategory(false);
  };

  const addExpenseCategory = () => {
    if (!newExpense.name.trim()) return;
    const category: ExpenseCategory = { id: uid(), name: newExpense.name.trim(), kind: newExpense.kind, defaultAmount: newExpense.kind === "fixed" ? parseMoney(newExpense.amount) : 0 };
    setState((prev) => ({ ...prev, expenseCategories: [...prev.expenseCategories, category] }));
    setExpenseEntry((prev) => ({ ...prev, categoryId: category.id }));
    setSelectedExpenseId(category.id);
    setNewExpense({ name: "", kind: "variable", amount: "" });
    setShowNewExpenseCategory(false);
  };

  const openIncomeEdit = (transaction: IncomeTransaction) => {
    setEditingTransaction({ kind: "income", id: transaction.id, categoryId: transaction.categoryId, amount: transaction.amount.toLocaleString("vi-VN"), date: transaction.date, note: transaction.note });
  };

  const openExpenseEdit = (transaction: ExpenseEntry) => {
    setEditingTransaction({ kind: "expense", id: transaction.id, categoryId: transaction.categoryId, amount: transaction.amount.toLocaleString("vi-VN"), date: transaction.date, note: transaction.note });
  };

  const saveEditingTransaction = () => {
    if (!editingTransaction) return;
    const amount = parseMoney(editingTransaction.amount);
    if (!amount || !editingTransaction.date) return;
    setState((prev) => {
      if (editingTransaction.kind === "income") {
        return {
          ...prev,
          incomeTransactions: prev.incomeTransactions.map((item) => item.id === editingTransaction.id ? { ...item, categoryId: editingTransaction.categoryId, amount, date: editingTransaction.date, month: monthFromDate(editingTransaction.date), note: editingTransaction.note } : item),
        };
      }
      return {
        ...prev,
        expenseEntries: prev.expenseEntries.map((item) => item.id === editingTransaction.id ? { ...item, categoryId: editingTransaction.categoryId, amount, date: editingTransaction.date, month: monthFromDate(editingTransaction.date), note: editingTransaction.note } : item),
      };
    });
    setEditingTransaction(null);
  };

  const deleteIncomeTransaction = (transaction: { id: string }) => {
    if (!window.confirm("Xóa khoản thu này?")) return;
    setState((prev) => ({ ...prev, incomeTransactions: prev.incomeTransactions.filter((item) => item.id !== transaction.id) }));
  };

  const deleteExpenseTransaction = (transaction: { id: string }) => {
    if (!window.confirm("Xóa khoản chi này?")) return;
    setState((prev) => ({ ...prev, expenseEntries: prev.expenseEntries.filter((item) => item.id !== transaction.id) }));
  };

  const deleteExpenseCategory = (category: ExpenseCategory) => {
    if (!window.confirm(`Xóa mục ${category.name}?`)) return;
    setState((prev) => ({
      ...prev,
      expenseCategories: prev.expenseCategories.filter((item) => item.id !== category.id),
      monthlyExpenses: prev.monthlyExpenses.filter((item) => item.categoryId !== category.id),
      expenseEntries: prev.expenseEntries.filter((item) => item.categoryId !== category.id),
    }));
    if (selectedExpenseId === category.id) setSelectedExpenseId(null);
  };

  const saveFixedAmount = () => {
    if (!editingFixed) return;
    const category = state.expenseCategories.find((item) => item.id === editingFixed.categoryId);
    if (!category) return;
    updateMonthlyExpense(category, { amount: parseMoney(editingFixed.amount) });
    setEditingFixed(null);
  };

  const confirmAllocation = () => {
    const existingAllocation = state.allocations.find((item) => item.month === month);
    if (existingAllocation?.confirmedAt || percentTotal !== 100 || summary.saving <= 0) return;
    const confirmedAllocation: Allocation = {
      ...summary.allocation,
      confirmedAt: new Date().toISOString(),
      btcAmount: Math.round(summary.allocationAmounts.btc),
      stockAmount: Math.round(summary.allocationAmounts.stock),
      savingAmount: Math.round(summary.allocationAmounts.saving),
      emergencyAmount: Math.round(summary.allocationAmounts.emergency),
      totalSavingAtConfirm: Math.round(summary.saving),
    };
    if ((confirmedAllocation.savingAmount ?? 0) > 0) confirmedAllocation.savingDepositRequestedAt = confirmedAllocation.confirmedAt;
    if ((confirmedAllocation.emergencyAmount ?? 0) > 0) confirmedAllocation.emergencyDepositRequestedAt = confirmedAllocation.confirmedAt;
    setState((prev) => ({
      ...prev,
      allocations: prev.allocations.some((item) => item.month === month) ? prev.allocations.map((item) => (item.month === month ? confirmedAllocation : item)) : [...prev.allocations, confirmedAllocation],
      fundTransactions: [
        ...prev.fundTransactions,
        { id: uid(), fund: "btc", type: "deposit", amount: confirmedAllocation.btcAmount ?? 0, date: `${depositForm.month}-01`, month, note: depositForm.note },
        { id: uid(), fund: "stock", type: "deposit", amount: confirmedAllocation.stockAmount ?? 0, date: `${depositForm.month}-01`, month, note: depositForm.note },
      ],
    }));
    setConfirmOpen(false);
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Tháng {formatMonth(month)}</h1>
        </div>
        <MonthPicker month={month} setMonth={setMonth} />
      </header>

      <section className="metrics-grid">
        <MetricCard label="Thu nhập" value={formatVnd(summary.income)} icon={<BadgeDollarSign size={20} />} />
        <MetricCard label="Chi tiêu" value={formatVnd(summary.expense)} icon={<ArrowDownCircle size={20} />} />
        <MetricCard label="Tiết kiệm tháng" value={formatVnd(summary.saving)} icon={<PiggyBank size={20} />} tone="highlight" />
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel-title">
            <h2>Thu nhập</h2>
            <button className="icon-button" title="Thêm thu nhập" onClick={() => setEntryModal("income")}>
              <Plus size={18} />
            </button>
          </div>
          <BreakdownPie data={summary.incomeRows} />
          <DetailList rows={summary.incomeRows} selectedId={selectedIncomeId} onSelect={setSelectedIncomeId} />
          <CategoryHistoryPanel title={selectedIncome?.name ?? "Thu nhập"} rows={selectedIncome?.transactions ?? []} emptyText="Chưa có khoản thu nào trong tháng này." itemTone="income" onEdit={(item) => openIncomeEdit(item as IncomeTransaction)} onDelete={deleteIncomeTransaction} />
        </article>

        <article className="panel">
          <div className="panel-title">
            <h2>Chi tiêu</h2>
            <button className="icon-button" title="Thêm khoản chi" onClick={() => setEntryModal("expense")}>
              <Plus size={18} />
            </button>
          </div>
          <BreakdownPie data={summary.expenseRows} />
          <DetailList rows={summary.expenseRows} selectedId={selectedExpenseId} onSelect={setSelectedExpenseId} />
          <CategoryHistoryPanel title={selectedExpense?.name ?? "Chi tiêu"} rows={selectedExpense?.transactions ?? []} emptyText="Chưa có khoản phát sinh nào trong tháng này." itemTone="expense" onEdit={(item) => openExpenseEdit(item as ExpenseEntry)} onDelete={deleteExpenseTransaction} />
        </article>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Tiền được chia</h2>
          <button className="icon-button" title="Chỉnh chia quỹ" onClick={() => setAllocationEditing((current) => !current)}>
            <Pencil size={17} />
          </button>
        </div>
        <div className="allocation-grid">
          <FundChip label="BTC" value={summary.allocationAmounts.btc} percent={summary.allocation.btcPercent} />
          <FundChip label="CK" value={summary.allocationAmounts.stock} percent={summary.allocation.stockPercent} />
          <FundChip label="Quỹ tiết kiệm" value={summary.allocationAmounts.saving} percent={summary.allocation.savingPercent} />
          <FundChip label="Dự phòng" value={summary.allocationAmounts.emergency} percent={summary.allocation.emergencyPercent} />
        </div>
        {allocationEditing && (
          <div className="allocation-inline">
            <div className="panel-title compact-title">
              <h3>Chỉnh chia quỹ</h3>
              <div className="allocation-title-meta">
                <small className={percentTotal === 100 ? "ok" : "bad"}>Tỷ lệ: {percentTotal}%</small>
                <small className={amountTotalMatchesSaving ? "ok" : "bad"}>Tổng tiền: {formatVnd(allocationAmountTotal)} / {formatVnd(availableAllocationAmount)}</small>
              </div>
            </div>
            <div className="allocation-editor">
              {allocationAmountRows.map((item) => (
                <div className="allocation-field" key={item.percentKey}>
                  <span>{item.label}</span>
                  <input type="number" min="0" max="100" value={summary.allocation[item.percentKey]} onChange={(event) => updateAllocation({ [item.percentKey]: Number(event.target.value) } as Partial<Allocation>)} aria-label={`${item.label} tỷ lệ phần trăm`} placeholder="%" />
                  <input className="amount-input" inputMode="numeric" value={allocationAmountInputs[item.amountKey] ?? Math.round(item.amount).toLocaleString("vi-VN")} onChange={(event) => updateAllocationAmount(item.amountKey, event.target.value)} onBlur={() => commitAllocationAmount(item.amountKey)} aria-label={`${item.label} số tiền`} placeholder="Số tiền" />
                </div>
              ))}
            </div>
            <div className="deposit-confirm">
              <label>
                Tháng chia quỹ
                <input type="month" value={depositForm.month} onChange={(event) => setDepositForm({ ...depositForm, month: event.target.value })} />
              </label>
              <button className="primary" onClick={() => setConfirmOpen(true)} disabled={percentTotal !== 100 || summary.saving <= 0 || monthAlreadyConfirmed}>
                <CheckCircle2 size={17} /> Xác nhận chia quỹ
              </button>
              {monthAlreadyConfirmed && <small className="ok">Tháng này đã xác nhận chia quỹ.</small>}
            </div>
          </div>
        )}
      </section>

      <section className="two-column compact">
        <article className="panel">
          <div className="panel-title">
            <h2>Checklist khoản cố định</h2>
            <small>Tick mới tính vào chi tiêu</small>
          </div>
          <div className="check-list">
            {fixedCategories.map((category) => {
              const record = getMonthlyExpense(state, category, month);
              return (
                <div key={category.id} className={record.checked ? "done fixed-check-row" : "fixed-check-row"}>
                  <button className={record.checked ? "check-icon checked" : "check-icon"} title={record.checked ? "Bỏ tick khoản cố định" : "Tick khoản cố định"} onClick={() => updateMonthlyExpense(category, { checked: !record.checked })} type="button">
                    <CheckCircle2 size={18} />
                  </button>
                  <span>{category.name}</span>
                  <strong>{formatVnd(record.amount)}</strong>
                  <button className="row-icon-button" title="Sửa số tiền tháng này" onClick={() => setEditingFixed({ categoryId: category.id, amount: record.amount.toLocaleString("vi-VN") })} type="button">
                    <Pencil size={15} />
                  </button>
                  <button className="row-icon-button danger-text" title="Xóa mục" onClick={() => deleteExpenseCategory(category)} type="button">
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </article>

        <article className="panel">
          <div className="panel-title">
            <h2>Sổ sắp đáo hạn</h2>
            <button className="ghost" onClick={() => setPage("mbb")}>Xem</button>
          </div>
          {dueSoon.length === 0 ? (
            <p className="muted">Chưa có sổ nào cần xử lý trong 30 ngày tới.</p>
          ) : (
            <div className="deposit-mini-list">
              {dueSoon.map((item) => (
                <div className={item.dueDays <= 7 ? "danger" : "warning"} key={item.id}>
                  <CalendarClock size={18} />
                  <span>{item.fund === "saving" ? "Quỹ tiết kiệm" : "Quỹ dự phòng"}</span>
                  <strong>{formatVnd(item.principal)}</strong>
                  <small>{item.dueDays <= 0 ? "Đã đáo hạn" : `${item.dueDays} ngày nữa`}</small>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      {entryModal === "income" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="income-modal-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="income-modal-title">Thêm thu nhập</h2>
              <button className="icon-button" title="Đóng" onClick={() => setEntryModal(null)}><X size={17} /></button>
            </div>
            <div className="form-grid">
              <label>Mục thu<select value={incomeForm.categoryId} onChange={(event) => setIncomeForm({ ...incomeForm, categoryId: event.target.value })}>{state.incomeCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
              <label>Số tiền<input value={incomeForm.amount} onChange={(event) => setIncomeForm({ ...incomeForm, amount: event.target.value })} placeholder="9.000.000" /></label>
              <label>Ngày<input type="date" value={incomeForm.date} onChange={(event) => setIncomeForm({ ...incomeForm, date: event.target.value })} /></label>
              <label>Ghi chú<input value={incomeForm.note} onChange={(event) => setIncomeForm({ ...incomeForm, note: event.target.value })} placeholder="Fishing, job..." /></label>
            </div>
            <button className="primary full" onClick={addIncome}><Plus size={17} /> Thêm thu nhập</button>
            {!showNewIncomeCategory ? (
              <button className="ghost full" onClick={() => setShowNewIncomeCategory(true)}><Plus size={17} /> Thêm mục mới</button>
            ) : (
              <div className="inline-add modal-inline-add">
                <input value={newIncome.name} onChange={(event) => setNewIncome({ ...newIncome, name: event.target.value })} placeholder="Mục thu nhập mới" />
                <select value={newIncome.kind} onChange={(event) => setNewIncome({ ...newIncome, kind: event.target.value as IncomeCategory["kind"] })}><option value="variable">Phát sinh</option><option value="fixed">Cố định</option></select>
                <button onClick={addIncomeCategory} title="Thêm mục"><Plus size={17} /></button>
              </div>
            )}
          </section>
        </div>
      )}

      {entryModal === "expense" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="expense-modal-title">Thêm khoản chi</h2>
              <button className="icon-button" title="Đóng" onClick={() => setEntryModal(null)}><X size={17} /></button>
            </div>
            <div className="form-grid">
              <label>Mục chi<select value={expenseEntry.categoryId} onChange={(event) => setExpenseEntry({ ...expenseEntry, categoryId: event.target.value })}>{state.expenseCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
              <label>Số tiền<input value={expenseEntry.amount} onChange={(event) => setExpenseEntry({ ...expenseEntry, amount: event.target.value })} placeholder="500.000" /></label>
              <label>Ngày<input type="date" value={expenseEntry.date} onChange={(event) => setExpenseEntry({ ...expenseEntry, date: event.target.value })} /></label>
              <label>Ghi chú<input value={expenseEntry.note} onChange={(event) => setExpenseEntry({ ...expenseEntry, note: event.target.value })} placeholder="Sửa xe, mua đồ..." /></label>
            </div>
            <button className="primary full" onClick={addExpenseEntry}><Plus size={17} /> Thêm khoản chi</button>
            {!showNewExpenseCategory ? (
              <button className="ghost full" onClick={() => setShowNewExpenseCategory(true)}><Plus size={17} /> Thêm mục mới</button>
            ) : (
              <div className="inline-add modal-inline-add">
                <input value={newExpense.name} onChange={(event) => setNewExpense({ ...newExpense, name: event.target.value })} placeholder="Mục chi mới" />
                {newExpense.kind === "fixed" && <input value={newExpense.amount} onChange={(event) => setNewExpense({ ...newExpense, amount: event.target.value })} placeholder="Số tiền mặc định" />}
                <select value={newExpense.kind} onChange={(event) => setNewExpense({ ...newExpense, kind: event.target.value as NewExpenseKind })}><option value="variable">Phát sinh</option><option value="fixed">Cố định</option></select>
                <button onClick={addExpenseCategory} title="Thêm mục"><Plus size={17} /></button>
              </div>
            )}
          </section>
        </div>
      )}

      {editingFixed && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="fixed-edit-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="fixed-edit-title">Sửa khoản cố định</h2>
              <button className="icon-button" title="Đóng" onClick={() => setEditingFixed(null)}><X size={17} /></button>
            </div>
            <label>Số tiền tháng này<input value={editingFixed.amount} onChange={(event) => setEditingFixed({ ...editingFixed, amount: event.target.value })} /></label>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setEditingFixed(null)}>Hủy</button>
              <button className="primary" onClick={saveFixedAmount}><Save size={17} /> Lưu</button>
            </div>
          </section>
        </div>
      )}

      {editingTransaction && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-transaction-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="edit-transaction-title">Điều chỉnh {editingTransaction.kind === "income" ? "thu nhập" : "chi tiêu"}</h2>
              <button className="icon-button" title="Đóng" onClick={() => setEditingTransaction(null)}><X size={17} /></button>
            </div>
            <div className="form-grid">
              <label>Mục<select value={editingTransaction.categoryId} onChange={(event) => setEditingTransaction({ ...editingTransaction, categoryId: event.target.value })}>{(editingTransaction.kind === "income" ? state.incomeCategories : state.expenseCategories).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
              <label>Số tiền<input value={editingTransaction.amount} onChange={(event) => setEditingTransaction({ ...editingTransaction, amount: event.target.value })} /></label>
              <label>Ngày<input type="date" value={editingTransaction.date} onChange={(event) => setEditingTransaction({ ...editingTransaction, date: event.target.value })} /></label>
              <label>Ghi chú<input value={editingTransaction.note} onChange={(event) => setEditingTransaction({ ...editingTransaction, note: event.target.value })} /></label>
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setEditingTransaction(null)}>Hủy</button>
              <button className="primary" onClick={saveEditingTransaction}><Save size={17} /> Lưu điều chỉnh</button>
            </div>
          </section>
        </div>
      )}

      {confirmOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="allocation-confirm-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="allocation-confirm-title">Xác nhận chia quỹ</h2>
              <small>Tháng {formatMonth(month)}</small>
            </div>
            <p className="muted">App sẽ ghi giao dịch vào BTC/CK. Quỹ tiết kiệm và Dự phòng sẽ được đánh dấu chờ tạo sổ ở trang riêng.</p>
            {!hasCustomAllocationAmounts && (summary.allocationAmounts.savingRemainder > 0 || summary.allocationAmounts.emergencyRemainder > 0) && <p className="muted">Số lẻ sau khi làm tròn bội số {formatVnd(CERTIFICATE_LOT)} được cộng vào BTC.</p>}
            <div className="confirm-summary">
              <div><span>BTC</span><strong>{formatVnd(summary.allocationAmounts.btc)}</strong></div>
              <div><span>CK</span><strong>{formatVnd(summary.allocationAmounts.stock)}</strong></div>
              <div><span>Quỹ tiết kiệm</span><strong>{formatVnd(summary.allocationAmounts.saving)}</strong></div>
              <div><span>Dự phòng</span><strong>{formatVnd(summary.allocationAmounts.emergency)}</strong></div>
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setConfirmOpen(false)}>Hủy</button>
              <button className="primary" onClick={confirmAllocation}><CheckCircle2 size={17} /> Đồng ý chia quỹ</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function DetailList({
  rows,
  selectedId,
  onSelect,
}: {
  rows: Array<{ id: string; name: string; value: number; transactions: Array<{ id: string }> }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="detail-list">
      {rows
        .filter((item) => item.value > 0)
        .map((item, index) => (
          <button
            className={selectedId === item.id ? "selected" : ""}
            key={item.id}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            <span style={{ "--dot": COLORS[index % COLORS.length] } as React.CSSProperties}>{item.name}</span>
            <strong>{formatVnd(item.value)}</strong>
            <small>{item.transactions.length} mục</small>
          </button>
        ))}
    </div>
  );
}

function CategoryHistoryPanel({
  title,
  rows,
  emptyText,
  itemTone,
  onEdit,
  onDelete,
}: {
  title: string;
  rows: Array<{ id: string; categoryId?: string; amount: number; date: string; note: string }>;
  emptyText: string;
  itemTone: "income" | "expense";
  onEdit?: (item: { id: string; categoryId?: string; amount: number; date: string; note: string }) => void;
  onDelete?: (item: { id: string; categoryId?: string; amount: number; date: string; note: string }) => void;
}) {
  return (
    <div className="category-history">
      <div className="panel-title compact-title">
        <h3>{title}</h3>
        <small>{rows.length} giao dịch</small>
      </div>
      {rows.length === 0 ? (
        <p className="muted">{emptyText}</p>
      ) : (
        <div className="timeline history-timeline">
          {rows.map((item) => (
            <div key={item.id} className={itemTone}>
              <span className={itemTone}>{itemTone === "income" ? "+" : "-"}</span>
              <div className="history-row-body">
                <div>
                  <strong>{formatVnd(item.amount)}</strong>
                  <small>
                    {formatDate(item.date)} · {item.note || "Không ghi chú"}
                  </small>
                </div>
                {onEdit && (
                  <button className="row-icon-button history-edit-button" onClick={() => onEdit(item)} title="Sửa giao dịch" type="button">
                    <Pencil size={15} />
                  </button>
                )}
                {onDelete && (
                  <button className="row-icon-button history-delete-button danger-text" onClick={() => onDelete(item)} title="Xóa giao dịch" type="button">
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FundChip({ label, value, percent }: { label: string; value: number; percent: number }) {
  return (
    <div className="fund-chip">
      <small>
        {label} <b>{percent}%</b>
      </small>
      <strong>{formatVnd(value)}</strong>
    </div>
  );
}

function MoneyPage({
  state,
  setState,
  month,
  setMonth,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  month: string;
  setMonth: (month: string) => void;
}) {
  const summary = monthlySummary(state, month);
  const [historyIncomeId, setHistoryIncomeId] = useState<string | null>(null);
  const [historyExpenseId, setHistoryExpenseId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<
    | {
        kind: "income";
        id: string;
        categoryId: string;
        amount: string;
        date: string;
        note: string;
      }
    | {
        kind: "expense";
        id: string;
        categoryId: string;
        amount: string;
        date: string;
        note: string;
      }
    | null
  >(null);
  const [incomeForm, setIncomeForm] = useState({
    categoryId: state.incomeCategories.find((category) => category.id === "other-income")?.id ?? state.incomeCategories[0]?.id ?? "",
    amount: "",
    date: today(),
    note: "",
  });
  const [expenseEntry, setExpenseEntry] = useState({
    categoryId: "phat-sinh",
    amount: "",
    date: today(),
    note: "",
  });
  const [newIncome, setNewIncome] = useState({ name: "", kind: "variable" as IncomeCategory["kind"] });
  const [newExpense, setNewExpense] = useState({ name: "", kind: "fixed" as ExpenseCategory["kind"], amount: "" });
  const [depositForm, setDepositForm] = useState({
    month,
    note: "Chia quỹ cuối tháng",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [allocationAmountInputs, setAllocationAmountInputs] = useState<Partial<Record<AllocationAmountKey, string>>>({});

  useEffect(() => {
    setDepositForm((prev) => (prev.month === month ? prev : { ...prev, month }));
    setAllocationAmountInputs({});
  }, [month]);

  useEffect(() => {
    setHistoryIncomeId((current) => {
      if (current && summary.incomeRows.some((row) => row.id === current)) return current;
      return summary.incomeRows.find((row) => row.id === "other-income" && row.value > 0)?.id ?? summary.incomeRows.find((row) => row.value > 0)?.id ?? summary.incomeRows[0]?.id ?? null;
    });
    setHistoryExpenseId((current) => {
      if (current && summary.expenseRows.some((row) => row.id === current)) return current;
      return summary.expenseRows.find((row) => row.id === "phat-sinh" && row.value > 0)?.id ?? summary.expenseRows.find((row) => row.value > 0)?.id ?? summary.expenseRows[0]?.id ?? null;
    });
  }, [month, summary.expenseRows, summary.incomeRows]);

  const historyIncome = summary.incomeRows.find((row) => row.id === historyIncomeId) ?? null;
  const historyExpense = summary.expenseRows.find((row) => row.id === historyExpenseId) ?? null;

  const openIncomeEdit = (transaction: IncomeTransaction) => {
    setEditingTransaction({
      kind: "income",
      id: transaction.id,
      categoryId: transaction.categoryId,
      amount: transaction.amount.toLocaleString("vi-VN"),
      date: transaction.date,
      note: transaction.note,
    });
  };

  const openExpenseEdit = (transaction: ExpenseEntry) => {
    setEditingTransaction({
      kind: "expense",
      id: transaction.id,
      categoryId: transaction.categoryId,
      amount: transaction.amount.toLocaleString("vi-VN"),
      date: transaction.date,
      note: transaction.note,
    });
  };

  const saveEditingTransaction = () => {
    if (!editingTransaction) return;
    const amount = parseMoney(editingTransaction.amount);
    if (!amount || !editingTransaction.date) return;

    setState((prev) => {
      if (editingTransaction.kind === "income") {
        return {
          ...prev,
          incomeTransactions: prev.incomeTransactions.map((item) =>
            item.id === editingTransaction.id
              ? {
                  ...item,
                  categoryId: editingTransaction.categoryId,
                  amount,
                  date: editingTransaction.date,
                  month: monthFromDate(editingTransaction.date),
                  note: editingTransaction.note,
                }
              : item
          ),
        };
      }

      return {
        ...prev,
        expenseEntries: prev.expenseEntries.map((item) =>
          item.id === editingTransaction.id
            ? {
                ...item,
                categoryId: editingTransaction.categoryId,
                amount,
                date: editingTransaction.date,
                month: monthFromDate(editingTransaction.date),
                note: editingTransaction.note,
              }
            : item
        ),
      };
    });
    setEditingTransaction(null);
  };

  const deleteIncomeTransaction = (transaction: { id: string; amount: number; date: string; note: string }) => {
    if (!window.confirm("Xóa khoản thu này?")) return;
    setState((prev) => ({
      ...prev,
      incomeTransactions: prev.incomeTransactions.filter((item) => item.id !== transaction.id),
    }));
  };

  const deleteExpenseTransaction = (transaction: { id: string; amount: number; date: string; note: string }) => {
    if (!window.confirm("Xóa khoản chi này?")) return;
    setState((prev) => ({
      ...prev,
      expenseEntries: prev.expenseEntries.filter((item) => item.id !== transaction.id),
    }));
  };

  const updateMonthlyExpense = (category: ExpenseCategory, patch: Partial<MonthlyExpense>) => {
    setState((prev) => {
      const existing = prev.monthlyExpenses.find((item) => item.categoryId === category.id && item.month === month);
      const next = existing ? { ...existing, ...patch } : { ...getMonthlyExpense(prev, category, month), ...patch };
      return {
        ...prev,
        monthlyExpenses: existing
          ? prev.monthlyExpenses.map((item) => (item.id === existing.id ? next : item))
          : [...prev.monthlyExpenses, next],
      };
    });
  };

  const updateAllocation = (patch: Partial<Allocation>) => {
    setState((prev) => {
      const existing = prev.allocations.find((item) => item.month === month);
      const next = { ...getAllocation(prev, month), ...patch };
      return {
        ...prev,
        allocations: existing ? prev.allocations.map((item) => (item.month === month ? next : item)) : [...prev.allocations, next],
      };
    });
  };

  const updateAllocationAmount = (key: AllocationAmountKey, value: string) => {
    setAllocationAmountInputs((prev) => ({ ...prev, [key]: value }));
    updateAllocation({ [key]: value.trim() === "" ? undefined : parseMoney(value) } as Partial<Allocation>);
  };

  const commitAllocationAmount = (key: AllocationAmountKey) => {
    setAllocationAmountInputs((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      const value = next[key] ?? "";
      if (value.trim() === "") {
        delete next[key];
      } else {
        next[key] = parseMoney(value).toLocaleString("vi-VN");
      }
      return next;
    });
  };

  const addIncome = () => {
    const amount = parseMoney(incomeForm.amount);
    if (!amount || !incomeForm.categoryId) return;
    setState((prev) => ({
      ...prev,
      incomeTransactions: [
        ...prev.incomeTransactions,
        {
          id: uid(),
          categoryId: incomeForm.categoryId,
          amount,
          date: incomeForm.date,
          month: monthFromDate(incomeForm.date),
          note: incomeForm.note,
        },
      ],
    }));
    setIncomeForm((prev) => ({ ...prev, amount: "", note: "" }));
  };

  const addExpenseEntry = () => {
    const amount = parseMoney(expenseEntry.amount);
    if (!amount || !expenseEntry.categoryId) return;
    setState((prev) => ({
      ...prev,
      expenseEntries: [
        ...prev.expenseEntries,
        {
          id: uid(),
          categoryId: expenseEntry.categoryId,
          amount,
          date: expenseEntry.date,
          month: monthFromDate(expenseEntry.date),
          note: expenseEntry.note,
        },
      ],
    }));
    setExpenseEntry((prev) => ({ ...prev, amount: "", note: "" }));
  };

  const addIncomeCategory = () => {
    if (!newIncome.name.trim()) return;
    const category = { id: uid(), name: newIncome.name.trim(), kind: newIncome.kind };
    setState((prev) => ({ ...prev, incomeCategories: [...prev.incomeCategories, category] }));
    setIncomeForm((prev) => ({ ...prev, categoryId: category.id }));
    setNewIncome({ name: "", kind: "variable" });
  };

  const addExpenseCategory = () => {
    if (!newExpense.name.trim()) return;
    const category: ExpenseCategory = {
      id: uid(),
      name: newExpense.name.trim(),
      kind: newExpense.kind,
      defaultAmount: parseMoney(newExpense.amount),
    };
    setState((prev) => ({ ...prev, expenseCategories: [...prev.expenseCategories, category] }));
    setNewExpense({ name: "", kind: "fixed", amount: "" });
  };

  const confirmAllocation = () => {
    const existingAllocation = state.allocations.find((item) => item.month === month);
    if (existingAllocation?.confirmedAt) return;

    const totalPercent =
      summary.allocation.btcPercent +
      summary.allocation.stockPercent +
      summary.allocation.savingPercent +
      summary.allocation.emergencyPercent;
    if (totalPercent !== 100 || summary.saving <= 0) return;

    const confirmedAllocation: Allocation = {
      ...summary.allocation,
      confirmedAt: new Date().toISOString(),
      btcAmount: Math.round(summary.allocationAmounts.btc),
      stockAmount: Math.round(summary.allocationAmounts.stock),
      savingAmount: Math.round(summary.allocationAmounts.saving),
      emergencyAmount: Math.round(summary.allocationAmounts.emergency),
      totalSavingAtConfirm: Math.round(summary.saving),
    };
    if ((confirmedAllocation.savingAmount ?? 0) > 0) confirmedAllocation.savingDepositRequestedAt = confirmedAllocation.confirmedAt;
    if ((confirmedAllocation.emergencyAmount ?? 0) > 0) confirmedAllocation.emergencyDepositRequestedAt = confirmedAllocation.confirmedAt;

    setState((prev) => ({
      ...prev,
      allocations: prev.allocations.some((item) => item.month === month)
        ? prev.allocations.map((item) => (item.month === month ? confirmedAllocation : item))
        : [...prev.allocations, confirmedAllocation],
      fundTransactions: [
        ...prev.fundTransactions,
        {
          id: uid(),
          fund: "btc",
          type: "deposit",
          amount: confirmedAllocation.btcAmount ?? 0,
          date: `${depositForm.month}-01`,
          month,
          note: "Chia quỹ cuối tháng",
        },
        {
          id: uid(),
          fund: "stock",
          type: "deposit",
          amount: confirmedAllocation.stockAmount ?? 0,
          date: `${depositForm.month}-01`,
          month,
          note: "Chia quỹ cuối tháng",
        },
      ],
    }));
    setConfirmOpen(false);
  };

  const monthAlreadyConfirmed = Boolean(summary.allocation.confirmedAt);

  const percentTotal =
    summary.allocation.btcPercent +
    summary.allocation.stockPercent +
    summary.allocation.savingPercent +
    summary.allocation.emergencyPercent;
  const allocationAmountRows: Array<{
    percentKey: AllocationPercentKey;
    amountKey: AllocationAmountKey;
    label: string;
    amount: number;
  }> = [
    { percentKey: "btcPercent", amountKey: "btcAmount", label: "BTC", amount: summary.allocationAmounts.btc },
    { percentKey: "stockPercent", amountKey: "stockAmount", label: "CK", amount: summary.allocationAmounts.stock },
    { percentKey: "savingPercent", amountKey: "savingAmount", label: "Quỹ tiết kiệm", amount: summary.allocationAmounts.saving },
    { percentKey: "emergencyPercent", amountKey: "emergencyAmount", label: "Dự phòng", amount: summary.allocationAmounts.emergency },
  ];
  const allocationAmountTotal = allocationAmountRows.reduce((sum, item) => sum + Math.round(item.amount), 0);
  const availableAllocationAmount = Math.round(Math.max(summary.saving, 0));
  const amountTotalMatchesSaving = Math.abs(allocationAmountTotal - availableAllocationAmount) <= 1;
  const hasCustomAllocationAmounts = allocationAmountRows.some(
    (item) => typeof summary.allocation[item.amountKey] === "number"
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Thu nhập, chi tiêu, chia quỹ</p>
          <h1>Quản lý tháng {formatMonth(month)}</h1>
        </div>
        <MonthPicker month={month} setMonth={setMonth} />
      </header>

      <section className="metrics-grid">
        <MetricCard label="Thu nhập" value={formatVnd(summary.income)} icon={<BadgeDollarSign size={20} />} />
        <MetricCard label="Chi tiêu" value={formatVnd(summary.expense)} icon={<ArrowDownCircle size={20} />} />
        <MetricCard label="Có thể chia quỹ" value={formatVnd(summary.saving)} icon={<PiggyBank size={20} />} tone="highlight" />
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel-title">
            <h2>Thêm thu nhập</h2>
            <button className="icon-button" title="Lưu thu nhập" onClick={addIncome}>
              <Save size={18} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Mục
              <select value={incomeForm.categoryId} onChange={(event) => setIncomeForm({ ...incomeForm, categoryId: event.target.value })}>
                {state.incomeCategories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Số tiền
              <input value={incomeForm.amount} onChange={(event) => setIncomeForm({ ...incomeForm, amount: event.target.value })} placeholder="9.000.000" />
            </label>
            <label>
              Ngày
              <input type="date" value={incomeForm.date} onChange={(event) => setIncomeForm({ ...incomeForm, date: event.target.value })} />
            </label>
            <label>
              Ghi chú
              <input value={incomeForm.note} onChange={(event) => setIncomeForm({ ...incomeForm, note: event.target.value })} placeholder="Fishing, job..." />
            </label>
          </div>
          <button className="primary" onClick={addIncome}>
            <Plus size={17} /> Thêm thu nhập
          </button>

          <div className="inline-add">
            <input value={newIncome.name} onChange={(event) => setNewIncome({ ...newIncome, name: event.target.value })} placeholder="Mục thu nhập mới" />
            <select value={newIncome.kind} onChange={(event) => setNewIncome({ ...newIncome, kind: event.target.value as IncomeCategory["kind"] })}>
              <option value="variable">Phát sinh</option>
              <option value="fixed">Cố định</option>
            </select>
            <button onClick={addIncomeCategory} title="Thêm mục">
              <Plus size={17} />
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-title">
            <h2>Khoản phát sinh</h2>
            <button className="icon-button" title="Lưu khoản chi" onClick={addExpenseEntry}>
              <Save size={18} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Mục
              <select value={expenseEntry.categoryId} onChange={(event) => setExpenseEntry({ ...expenseEntry, categoryId: event.target.value })}>
                {state.expenseCategories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Số tiền
              <input value={expenseEntry.amount} onChange={(event) => setExpenseEntry({ ...expenseEntry, amount: event.target.value })} placeholder="500.000" />
            </label>
            <label>
              Ngày
              <input type="date" value={expenseEntry.date} onChange={(event) => setExpenseEntry({ ...expenseEntry, date: event.target.value })} />
            </label>
            <label>
              Note
              <input value={expenseEntry.note} onChange={(event) => setExpenseEntry({ ...expenseEntry, note: event.target.value })} placeholder="Sửa xe, mua đồ..." />
            </label>
          </div>
          <button className="primary" onClick={addExpenseEntry}>
            <Plus size={17} /> Thêm khoản chi
          </button>

          <div className="inline-add">
            <input value={newExpense.name} onChange={(event) => setNewExpense({ ...newExpense, name: event.target.value })} placeholder="Mục chi mới" />
            <input value={newExpense.amount} onChange={(event) => setNewExpense({ ...newExpense, amount: event.target.value })} placeholder="Số tiền" />
            <select value={newExpense.kind} onChange={(event) => setNewExpense({ ...newExpense, kind: event.target.value as ExpenseCategory["kind"] })}>
              <option value="fixed">Cố định</option>
              <option value="variable">Một lần</option>
            </select>
            <button onClick={addExpenseCategory} title="Thêm mục">
              <Plus size={17} />
            </button>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Chi tiêu tháng</h2>
          <small>Khoản cố định chỉ tính khi tick đã chuyển</small>
        </div>
        <div className="expense-editor">
          {state.expenseCategories.map((category) => {
            const record = getMonthlyExpense(state, category, month);
            const row = summary.expenseRows.find((item) => item.id === category.id);
            return (
              <div className="expense-row" key={category.id}>
                <div>
                  <strong>{category.name}</strong>
                  <small>{category.kind === "fixed" ? "Cố định" : "Phát sinh 1 lần"}</small>
                </div>
                {category.kind === "fixed" ? (
                  <>
                    <label>
                      Số tiền
                      <input value={record.amount.toLocaleString("vi-VN")} onChange={(event) => updateMonthlyExpense(category, { amount: parseMoney(event.target.value) })} />
                    </label>
                    <button className={record.checked ? "toggle checked" : "toggle"} onClick={() => updateMonthlyExpense(category, { checked: !record.checked })}>
                      <CheckCircle2 size={17} />
                      {record.checked ? "Đã chuyển" : "Chưa chuyển"}
                    </button>
                  </>
                ) : (
                  <div className="variable-summary">
                    <strong>{formatVnd(row?.value ?? 0)}</strong>
                    <small>{row?.transactions.length ?? 0} khoản phát sinh đã lưu</small>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="two-column compact history-grid">
        <article className="panel">
          <div className="panel-title">
            <h2>Lịch sử thu nhập</h2>
            <small>Bấm vào "Thu nhập khác" để xem chi tiết</small>
          </div>
          <DetailList rows={summary.incomeRows} selectedId={historyIncomeId} onSelect={setHistoryIncomeId} />
          <CategoryHistoryPanel
            title={historyIncome?.name ?? "Thu nhập"}
            rows={historyIncome?.transactions ?? []}
            emptyText="Chưa có khoản thu nào trong tháng này."
            itemTone="income"
            onEdit={(item) => openIncomeEdit(item as IncomeTransaction)}
            onDelete={deleteIncomeTransaction}
          />
        </article>

        <article className="panel">
          <div className="panel-title">
            <h2>Lịch sử phát sinh</h2>
            <small>Bấm vào "Phát sinh" để xem từng khoản</small>
          </div>
          <DetailList rows={summary.expenseRows} selectedId={historyExpenseId} onSelect={setHistoryExpenseId} />
          <CategoryHistoryPanel
            title={historyExpense?.name ?? "Phát sinh"}
            rows={historyExpense?.transactions ?? []}
            emptyText="Chưa có khoản phát sinh nào trong tháng này."
            itemTone="expense"
            onEdit={(item) => openExpenseEdit(item as ExpenseEntry)}
            onDelete={deleteExpenseTransaction}
          />
        </article>
      </section>

      {editingTransaction && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-transaction-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="edit-transaction-title">Điều chỉnh {editingTransaction.kind === "income" ? "thu nhập" : "chi tiêu"}</h2>
              <small>{editingTransaction.kind === "income" ? "Cập nhật giao dịch thu" : "Cập nhật giao dịch chi"}</small>
            </div>
            <div className="form-grid">
              <label>
                Mục
                <select
                  value={editingTransaction.categoryId}
                  onChange={(event) => setEditingTransaction({ ...editingTransaction, categoryId: event.target.value })}
                >
                  {(editingTransaction.kind === "income" ? state.incomeCategories : state.expenseCategories).map((category) => (
                    <option value={category.id} key={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Số tiền
                <input
                  value={editingTransaction.amount}
                  onChange={(event) => setEditingTransaction({ ...editingTransaction, amount: event.target.value })}
                  placeholder="9.000.000"
                />
              </label>
              <label>
                Ngày
                <input type="date" value={editingTransaction.date} onChange={(event) => setEditingTransaction({ ...editingTransaction, date: event.target.value })} />
              </label>
              <label>
                Ghi chú
                <input value={editingTransaction.note} onChange={(event) => setEditingTransaction({ ...editingTransaction, note: event.target.value })} />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setEditingTransaction(null)}>
                Hủy
              </button>
              <button className="primary" onClick={saveEditingTransaction}>
                <Save size={17} /> Lưu điều chỉnh
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="panel">
        <div className="panel-title">
          <h2>Chia quỹ cuối tháng</h2>
          <div className="allocation-title-meta">
            <small className={percentTotal === 100 ? "ok" : "bad"}>Tổng tỷ lệ {percentTotal}%</small>
            <small className={amountTotalMatchesSaving ? "ok" : "bad"}>
              Tổng tiền {formatVnd(allocationAmountTotal)} / {formatVnd(availableAllocationAmount)}
            </small>
          </div>
        </div>
        <div className="allocation-editor">
          {allocationAmountRows.map((item) => (
            <div className="allocation-field" key={item.percentKey}>
              <span>{item.label}</span>
              <input
                type="number"
                min="0"
                max="100"
                value={summary.allocation[item.percentKey]}
                onChange={(event) => updateAllocation({ [item.percentKey]: Number(event.target.value) } as Partial<Allocation>)}
                aria-label={`${item.label} tỷ lệ phần trăm`}
                placeholder="%"
              />
              <input
                className="amount-input"
                inputMode="numeric"
                value={allocationAmountInputs[item.amountKey] ?? Math.round(item.amount).toLocaleString("vi-VN")}
                onChange={(event) => updateAllocationAmount(item.amountKey, event.target.value)}
                onBlur={() => commitAllocationAmount(item.amountKey)}
                aria-label={`${item.label} số tiền`}
                placeholder="Số tiền"
              />
            </div>
          ))}
        </div>
        <div className="deposit-confirm">
          <label>
              Tháng chia quỹ
              <input type="month" value={depositForm.month} onChange={(event) => setDepositForm({ ...depositForm, month: event.target.value })} />
          </label>
          <button
            className="primary"
            onClick={() => setConfirmOpen(true)}
            disabled={percentTotal !== 100 || summary.saving <= 0 || monthAlreadyConfirmed}
          >
            <CheckCircle2 size={17} /> Xác nhận chia quỹ
          </button>
          {monthAlreadyConfirmed && <small className="ok">Tháng này đã xác nhận chia quỹ.</small>}
        </div>
      </section>
      {confirmOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="allocation-confirm-title">
          <section className="modal-card">
            <div className="panel-title">
              <h2 id="allocation-confirm-title">Xác nhận chia quỹ</h2>
              <small>Tháng {formatMonth(month)}</small>
            </div>
            <p className="muted">
              App sẽ ghi giao dịch vào BTC/CK. Quỹ tiết kiệm và Dự phòng sẽ được đánh dấu chờ tạo sổ ở trang riêng.
            </p>
            {!hasCustomAllocationAmounts && (summary.allocationAmounts.savingRemainder > 0 || summary.allocationAmounts.emergencyRemainder > 0) && (
              <p className="muted">
                Số lẻ sau khi làm tròn bội số {formatVnd(CERTIFICATE_LOT)} được cộng vào BTC.
              </p>
            )}
            <div className="confirm-summary">
              <div>
                <span>BTC</span>
                <strong>{formatVnd(summary.allocationAmounts.btc)}</strong>
              </div>
              <div>
                <span>CK</span>
                <strong>{formatVnd(summary.allocationAmounts.stock)}</strong>
              </div>
              <div>
                <span>Quỹ tiết kiệm</span>
                <strong>{formatVnd(summary.allocationAmounts.saving)}</strong>
              </div>
              <div>
                <span>Dự phòng</span>
                <strong>{formatVnd(summary.allocationAmounts.emergency)}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setConfirmOpen(false)}>
                Hủy
              </button>
              <button className="primary" onClick={confirmAllocation}>
                <CheckCircle2 size={17} /> Đồng ý chia quỹ
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function nextDepositCode(deposits: BankDeposit[], fund: DepositFund) {
  const prefix = fund === "saving" ? "TK" : "DP";
  const max = deposits
    .filter((deposit) => deposit.fund === fund && deposit.code.startsWith(`${prefix}-`))
    .map((deposit) => Number(deposit.code.replace(`${prefix}-`, "")))
    .filter(Number.isFinite)
    .reduce((highest, value) => Math.max(highest, value), 0);
  return `${prefix}-${String(max + 1).padStart(2, "0")}`;
}

function makeDeposit(
  existingDeposits: BankDeposit[],
  fund: DepositFund,
  amount: number,
  rate: number,
  termMonths: number,
  startDate: string,
  maturityDate: string,
  month: string,
  note: string,
  parentId?: string
): BankDeposit {
  const id = uid();
  return {
    id,
    code: nextDepositCode(existingDeposits, fund),
    fund,
    mbLast4: "",
    principal: Math.round(amount),
    rate,
    termMonths,
    startDate,
    maturityDate,
    status: "active",
    parentId,
    createdFromMonth: month,
    note,
  };
}

function FundPage({
  state,
  setState,
  fund,
  embedded = false,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  fund: FundKey;
  embedded?: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const label = fund === "btc" ? "BTC" : "CK";
  const rows = state.fundTransactions.filter((item) => item.fund === fund);
  const balance = rows.reduce((sum, item) => sum + (item.type === "deposit" ? item.amount : -item.amount), 0);

  const withdraw = () => {
    const value = parseMoney(amount);
    if (!value) return;
    setState((prev) => ({
      ...prev,
      fundTransactions: [
        ...prev.fundTransactions,
        { id: uid(), fund, type: "withdraw", amount: value, date: today(), month: currentMonth(), note },
      ],
    }));
    setAmount("");
    setNote("");
  };

  const content = (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Quỹ VND</p>
          <h1>Quỹ {label}</h1>
        </div>
      </header>
      <section className="metrics-grid single">
        <MetricCard label={`Tổng quỹ ${label}`} value={formatVnd(balance)} icon={fund === "btc" ? <Bitcoin size={20} /> : <LineChart size={20} />} tone="highlight" />
      </section>
      <section className="two-column compact">
        <article className="panel">
          <div className="panel-title">
            <h2>Rút tiền</h2>
            <small>Chỉ ghi lịch sử</small>
          </div>
          <div className="form-grid">
            <label>
              Số tiền
              <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="5.000.000" />
            </label>
            <label>
              Lý do
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Mua laptop..." />
            </label>
          </div>
          <button className="primary" onClick={withdraw}>
            <ArrowDownCircle size={17} /> Rút khỏi quỹ
          </button>
        </article>
        <HistoryPanel rows={rows} />
      </section>
    </>
  );

  if (embedded) return content;
  return <div className="page">{content}</div>;
}

function InvestmentPage({
  state,
  setState,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  const [activeTab, setActiveTab] = useState<InvestmentTab>("btc");
  const tabs: Array<{ id: InvestmentTab; label: string }> = [
    { id: "btc", label: "BTC" },
    { id: "stock", label: "CK" },
    { id: "sol", label: "SOL" },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1>Đầu tư</h1>
        </div>
      </header>
      <div className="deposit-tabs investment-tabs" role="tablist" aria-label="Chọn danh mục đầu tư">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "btc" && <FundPage state={state} setState={setState} fund="btc" embedded />}
      {activeTab === "stock" && <FundPage state={state} setState={setState} fund="stock" embedded />}
      {activeTab === "sol" && <SolPage state={state} setState={setState} embedded />}
    </div>
  );
}

function HistoryPanel({ rows }: { rows: FundTransaction[] }) {
  return (
    <article className="panel">
      <div className="panel-title">
        <h2>Lịch sử</h2>
        <small>{rows.length} giao dịch</small>
      </div>
      <div className="timeline">
        {[...rows].reverse().map((item) => (
          <div key={item.id}>
            <span className={item.type}>{item.type === "deposit" ? "+" : "-"}</span>
            <div>
              <strong>{formatVnd(item.amount)}</strong>
              <small>{formatDate(item.date)} · {item.note || "Không ghi chú"}</small>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function BankDepositPage({
  state,
  setState,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  const defaultDepositForm = (fund: DepositFund = "saving") => ({
    fund,
    amount: "",
    date: today(),
    maturityDate: addMonths(today(), 12),
    term: "12",
    rate: "6",
    note: "",
    sourceMonth: "",
    allocationSource: false,
  });
  const [form, setForm] = useState(() => defaultDepositForm());
  const [activeFilter, setActiveFilter] = useState<DepositFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [pendingSource, setPendingSource] = useState<BankDeposit | null>(null);
  const [earlySettlementDates, setEarlySettlementDates] = useState<Record<string, string>>({});
  const fundLabel = (fund: DepositFund) => (fund === "saving" ? "Tiết kiệm" : "Dự phòng");
  const filterOptions: Array<{ id: DepositFilter; label: string }> = [
    { id: "all", label: "Tổng" },
    { id: "saving", label: "Tiết kiệm" },
    { id: "emergency", label: "Dự phòng" },
  ];
  const fundOptions: Array<{ id: DepositFund; label: string }> = [
    { id: "saving", label: "Tiết kiệm" },
    { id: "emergency", label: "Dự phòng" },
  ];
  const rows = state.bankDeposits
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => activeFilter === "all" || item.fund === activeFilter)
    .sort((left, right) => right.item.startDate.localeCompare(left.item.startDate) || right.index - left.index)
    .map(({ item }) => item);
  const activeTotal = rows.reduce((sum, item) => sum + activePrincipal(item), 0);
  const pendingAllocations = state.allocations
    .filter((allocation) => allocation.confirmedAt)
    .flatMap((allocation) =>
      fundOptions.map(({ id }) => ({
        fund: id,
        month: allocation.month,
        amount: id === "saving" ? allocation.savingAmount ?? 0 : allocation.emergencyAmount ?? 0,
        depositRequestedAt: allocation[depositRequestedField(id)],
        depositCreatedAt: allocation[depositCreatedField(id)],
      }))
    )
    .filter(
      (allocation) =>
        allocation.amount > 0 &&
        allocation.depositRequestedAt &&
        !allocation.depositCreatedAt &&
        !state.bankDeposits.some((deposit) => deposit.fund === allocation.fund && deposit.createdFromMonth === allocation.month)
    )
    .sort((a, b) => a.month.localeCompare(b.month));

  const updateDepositDate = (date: string) => {
    setForm((prev) => ({ ...prev, date, maturityDate: addMonths(date, Number(prev.term) || 0) }));
  };

  const updateDepositTerm = (term: string) => {
    setForm((prev) => ({ ...prev, term, maturityDate: addMonths(prev.date, Number(term) || 0) }));
  };

  const openDepositForm = (nextForm: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...nextForm }));
    setFormOpen(true);
  };

  const openManualDepositForm = () => {
    setPendingSource(null);
    openDepositForm({ fund: activeFilter === "all" ? form.fund : activeFilter, allocationSource: false, sourceMonth: "" });
  };

  const prefillPendingDeposit = (allocation: { fund: DepositFund; month: string; amount: number }) => {
    setPendingSource(null);
    openDepositForm({
      fund: allocation.fund,
      amount: allocation.amount.toLocaleString("vi-VN"),
      date: today(),
      maturityDate: addMonths(today(), Number(form.term) || 0),
      sourceMonth: allocation.month,
      allocationSource: true,
      note: `Tạo sổ từ chia quỹ ${formatMonth(allocation.month)}`,
    });
  };

  const addDeposit = () => {
    const amount = parseMoney(form.amount);
    if (!amount) return;
    setState((prev) => {
      const sourceMonth = form.sourceMonth || monthFromDate(form.date);
      const nextDeposit = makeDeposit(
        prev.bankDeposits,
        form.fund,
        amount,
        Number(form.rate),
        Number(form.term),
        form.date,
        form.maturityDate,
        sourceMonth,
        form.note,
        pendingSource?.id
      );

      const bankDeposits = pendingSource
        ? prev.bankDeposits.map((item) =>
            item.id === pendingSource.id
              ? {
                  ...item,
                  status: "settled" as DepositStatus,
                  childId: nextDeposit.id,
                  settledAt: pendingSource.maturityDate,
                  settledAmount: nextDeposit.principal,
                }
              : item
          )
        : prev.bankDeposits;

      return {
        ...prev,
        bankDeposits: [...bankDeposits, nextDeposit],
        allocations: form.allocationSource
          ? prev.allocations.map((allocation) =>
              allocation.month === sourceMonth
                ? { ...allocation, [depositCreatedField(form.fund)]: new Date().toISOString() }
                : allocation
            )
          : prev.allocations,
      };
    });
    setForm(defaultDepositForm());
    setFormOpen(false);
    setPendingSource(null);
  };

  const settleEarly = (id: string, settlementDate: string) => {
    setState((prev) => ({
      ...prev,
      bankDeposits: prev.bankDeposits.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "early-settled",
              settledAt: settlementDate || today(),
              settledAmount: item.principal,
            }
          : item
      ),
    }));
    setEarlySettlementDates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const createNewFromMatured = (item: BankDeposit) => {
    const nextPrincipal = item.principal + interestFor(item);
    setPendingSource(item);
    openDepositForm({
      fund: item.fund,
      amount: nextPrincipal.toLocaleString("vi-VN"),
      date: item.maturityDate,
      maturityDate: addMonths(item.maturityDate, item.termMonths),
      term: String(item.termMonths),
      rate: String(item.rate),
      sourceMonth: monthFromDate(item.maturityDate),
      allocationSource: false,
      note: `Tạo mới từ ${item.code}`,
    });
  };

  const settleMatured = (id: string) => {
    setState((prev) => ({
      ...prev,
      bankDeposits: prev.bankDeposits.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "settled",
              settledAt: today(),
              settledAmount: item.principal + interestFor(item),
            }
          : item
      ),
    }));
  };

  const deleteDeposit = (item: BankDeposit) => {
    if (!window.confirm(`Xóa sổ ${item.code}? Thao tác này sẽ xóa sổ khỏi lịch sử và bảng tăng trưởng tài sản.`)) return;

    setState((prev) => ({
      ...prev,
      bankDeposits: prev.bankDeposits
        .filter((deposit) => deposit.id !== item.id)
        .map((deposit) => {
          if (deposit.childId === item.id) {
            return {
              ...deposit,
              status: "active" as DepositStatus,
              childId: undefined,
              settledAt: undefined,
              settledAmount: undefined,
            };
          }
          if (deposit.parentId === item.id) {
            return { ...deposit, parentId: undefined };
          }
          return deposit;
        }),
      allocations: item.createdFromMonth
        ? prev.allocations.map((allocation) =>
            allocation.month === item.createdFromMonth
              ? { ...allocation, [depositCreatedField(item.fund)]: allocation[depositCreatedField(item.fund)] ?? new Date().toISOString() }
              : allocation
          )
        : prev.allocations,
    }));
    setEarlySettlementDates((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    if (pendingSource?.id === item.id) setPendingSource(null);
  };

  const fundSelectionLocked = Boolean(form.sourceMonth);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Quỹ MBB</p>
          <h1>Sổ MBB</h1>
        </div>
      </header>
      <div className="deposit-tabs" role="tablist" aria-label="Lọc sổ MBB">
        {filterOptions.map((option) => (
          <button
            className={activeFilter === option.id ? "active" : ""}
            key={option.id}
            onClick={() => setActiveFilter(option.id)}
            role="tab"
            type="button"
            aria-selected={activeFilter === option.id}
          >
            {option.label}
          </button>
        ))}
      </div>
      <section className="metrics-grid single">
        <MetricCard label="Gốc đang gửi" value={formatVnd(activeTotal)} icon={<Landmark size={20} />} tone="highlight" />
      </section>
      {pendingAllocations.length > 0 && (
        <section className="pending-stack">
          {pendingAllocations.map((allocation) => (
            <article
              className="pending-banner clickable"
              key={`${allocation.fund}-${allocation.month}`}
              onClick={() => prefillPendingDeposit(allocation)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  prefillPendingDeposit(allocation);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div>
                <strong>{fundLabel(allocation.fund)} · Tháng {formatMonth(allocation.month)} chưa tạo sổ</strong>
                <small>{formatVnd(allocation.amount)}</small>
              </div>
              <button
                className="primary"
                onClick={(event) => {
                  event.stopPropagation();
                  prefillPendingDeposit(allocation);
                }}
              >
                <Plus size={17} /> Tạo sổ
              </button>
            </article>
          ))}
        </section>
      )}
      <section className="panel">
        <div className="panel-title">
          <h2>Thêm sổ MBB</h2>
          {!formOpen ? (
            <button className="ghost" onClick={openManualDepositForm}>
              Mở form
            </button>
          ) : (
            <button className="icon-button" title="Lưu sổ" onClick={addDeposit}>
              <Save size={18} />
            </button>
          )}
        </div>
        {formOpen && (
          <div className="deposit-confirm">
            {pendingSource && (
              <p className="muted deposit-source-hint">
                Tạo từ {pendingSource.code} · gốc {formatVnd(pendingSource.principal)} · lãi {formatVnd(interestFor(pendingSource))}
              </p>
            )}
            <div className="deposit-fund-field">
              <span>Loại sổ</span>
              <div className="deposit-fund-toggle" role="group" aria-label="Chọn loại sổ">
                {fundOptions.map((option) => (
                  <button
                    className={form.fund === option.id ? "active" : ""}
                    disabled={fundSelectionLocked}
                    key={option.id}
                    onClick={() => setForm({ ...form, fund: option.id })}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <label>
              Số tiền
              <input value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="6.000.000" />
            </label>
            <label>
              Ngày gửi
              <input type="date" value={form.date} onChange={(event) => updateDepositDate(event.target.value)} />
            </label>
            <label>
              Kỳ hạn tháng
              <input value={form.term} onChange={(event) => updateDepositTerm(event.target.value)} />
            </label>
            <label>
              Ngày đáo hạn
              <input type="date" value={form.maturityDate} onChange={(event) => setForm({ ...form, maturityDate: event.target.value })} />
            </label>
            <label>
              Lãi suất %
              <input value={form.rate} onChange={(event) => setForm({ ...form, rate: event.target.value })} />
            </label>
            <label>
              Note
              <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </label>
            <button className="primary" onClick={addDeposit}>
              <Plus size={17} /> Thêm sổ
            </button>
          </div>
        )}
      </section>

      <section className="deposit-list">
        {rows.map((item) => {
          const due = daysUntil(item.maturityDate);
          const matured = due <= 0 && item.status === "active";
          const interest = interestFor(item);
          return (
            <article className={`deposit-card ${due <= 7 && item.status === "active" ? "danger" : due <= 30 && item.status === "active" ? "warning" : ""}`} key={item.id}>
              <div className="deposit-head">
                <div>
                  <div className="deposit-code-row">
                    <small>{item.code}</small>
                    <span className={`fund-badge ${item.fund}`}>{fundLabel(item.fund)}</span>
                    <input
                      className="deposit-last4-inline"
                      value={item.mbLast4}
                      onChange={(event) =>
                        setState((prev) => ({
                          ...prev,
                          bankDeposits: prev.bankDeposits.map((deposit) =>
                            deposit.id === item.id ? { ...deposit, mbLast4: event.target.value.replace(/\D/g, "").slice(0, 4) } : deposit
                          ),
                        }))
                      }
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="4 số cuối"
                      aria-label={`4 số cuối sổ ${item.code}`}
                    />
                  </div>
                  <h3>{formatVnd(item.principal)}</h3>
                </div>
                <span className={`status ${item.status}`}>{matured ? "Đã đáo hạn - Chưa xử lý" : statusLabel(item.status)}</span>
              </div>
              <div className="deposit-meta">
                <span>Gửi {formatDate(item.startDate)}</span>
                <span>Đáo hạn {formatDate(item.maturityDate)}</span>
                <span>Kỳ hạn {item.termMonths} tháng</span>
                <span>Lãi {item.rate}%/năm</span>
                <span>Lãi cuối kỳ {formatVnd(interest)}</span>
                {item.status === "early-settled" && item.settledAt && <span>Tất toán trước hạn {formatDate(item.settledAt)}</span>}
              </div>
              {item.parentId && <p className="muted">Tạo mới từ sổ trước.</p>}
              {item.childId && <p className="muted">Đã tạo sổ mới từ sổ này.</p>}
              {matured && (
                <div className="card-actions">
                  <button className="primary" onClick={() => createNewFromMatured(item)}>
                    Tạo sổ mới
                  </button>
                  <button className="ghost" onClick={() => settleMatured(item.id)}>
                    Rút toàn bộ
                  </button>
                </div>
              )}
              {item.status === "active" && !matured && (
                <div className="card-actions">
                  <input
                    className="compact-date-input"
                    type="date"
                    value={earlySettlementDates[item.id] ?? today()}
                    onChange={(event) => setEarlySettlementDates((prev) => ({ ...prev, [item.id]: event.target.value }))}
                    aria-label={`Ngày tất toán trước hạn ${item.code}`}
                  />
                  <button className="ghost" onClick={() => settleEarly(item.id, earlySettlementDates[item.id] ?? today())}>
                    Tất toán trước hạn
                  </button>
                </div>
              )}
              <div className="card-actions deposit-delete-actions">
                <button className="ghost history-delete-button deposit-delete-button" onClick={() => deleteDeposit(item)} type="button">
                  Xóa sổ
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function statusLabel(status: DepositStatus) {
  const labels: Record<DepositStatus, string> = {
    active: "Đang gửi",
    "rolled-principal": "Đã quay vòng gốc",
    "rolled-all": "Đã quay vòng gốc + lãi",
    settled: "Đã tất toán",
    "early-settled": "Tất toán trước hạn",
  };
  return labels[status];
}

function SolPage({
  state,
  setState,
  embedded = false,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  embedded?: boolean;
}) {
  const [form, setForm] = useState({ sol: "", price: "", date: today(), note: "" });
  const totalSol = state.solTransactions.reduce((sum, item) => sum + item.solAmount, 0);
  const cost = state.solTransactions.reduce((sum, item) => sum + item.solAmount * item.buyPrice, 0);
  const currentUsd = totalSol * state.market.solUsd;
  const pnl = currentUsd - cost;
  const pnlPercent = cost ? (pnl / cost) * 100 : 0;
  const costVnd = cost * state.market.usdVnd;
  const pnlVnd = pnl * state.market.usdVnd;

  const addSol = () => {
    const sol = Number(form.sol.replace(",", "."));
    const price = Number(form.price.replace(",", "."));
    if (!sol || !price) return;
    setState((prev) => ({
      ...prev,
      solTransactions: [...prev.solTransactions, { id: uid(), solAmount: sol, buyPrice: price, date: form.date, note: form.note }],
    }));
    setForm({ sol: "", price: "", date: today(), note: "" });
  };

  const content = (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Coin portfolio</p>
          <h1>Tích lũy SOL</h1>
        </div>
      </header>
      <section className="metrics-grid">
        <MetricCard label="Tổng SOL" value={totalSol.toLocaleString("en-US", { maximumFractionDigits: 4 })} icon={<Coins size={20} />} />
        <MetricCard label="Vốn" value={formatUsd(cost)} subValue={formatVnd(costVnd)} icon={<CircleDollarSign size={20} />} />
        <MetricCard
          label="Lãi/lỗ"
          value={`${formatUsd(pnl)} · ${pnlPercent.toFixed(1)}%`}
          subValue={formatVnd(pnlVnd)}
          icon={<BarChart3 size={20} />}
          tone={pnl >= 0 ? "highlight" : "loss"}
        />
      </section>
      <section className="two-column compact">
        <article className="panel">
          <div className="panel-title">
            <h2>Giá thị trường</h2>
            <small>{state.market.updatedAt ? formatDate(state.market.updatedAt.slice(0, 10)) : "Chưa cập nhật"}</small>
          </div>
          <div className="market-grid">
            <div>
              <small>SOL</small>
              <strong>{state.market.solUsd ? formatUsd(state.market.solUsd) : "Đang chờ"}</strong>
            </div>
            <div>
              <small>USD/VND</small>
              <strong>{state.market.usdVnd ? formatVnd(state.market.usdVnd) : "Đang chờ"}</strong>
            </div>
            <div>
              <small>Giá trị VND</small>
              <strong>{formatVnd(currentUsd * state.market.usdVnd)}</strong>
            </div>
          </div>
        </article>
        <article className="panel">
          <div className="panel-title">
            <h2>Thêm giao dịch</h2>
            <button className="icon-button" title="Lưu SOL" onClick={addSol}>
              <Save size={18} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Số SOL
              <input value={form.sol} onChange={(event) => setForm({ ...form, sol: event.target.value })} placeholder="0.61" />
            </label>
            <label>
              Giá mua
              <input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="77.58" />
            </label>
            <label>
              Ngày
              <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </label>
            <label>
              Note
              <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </label>
          </div>
          <button className="primary" onClick={addSol}>
            <Plus size={17} /> Thêm SOL
          </button>
        </article>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Lịch sử SOL</h2>
          <small>Giá vốn trung bình {cost && totalSol ? formatUsd(cost / totalSol) : "0 USDT"}</small>
        </div>
        <div className="timeline">
          {[...state.solTransactions].reverse().map((item) => (
            <div key={item.id}>
              <span className="deposit">+</span>
              <div>
                <strong>{item.solAmount} SOL · {formatUsd(item.solAmount * item.buyPrice)}</strong>
                <small>{formatDate(item.date)} · Giá mua {formatUsd(item.buyPrice)} · {item.note || "Không ghi chú"}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  if (embedded) return content;
  return <div className="page">{content}</div>;
}

function ReportsPage({ state }: { state: AppState }) {
  const months = useMemo(() => {
    const allMonths = new Set<string>();
    state.incomeTransactions.forEach((item) => allMonths.add(item.month));
    state.expenseEntries.forEach((item) => allMonths.add(item.month));
    state.allocations.forEach((item) => allMonths.add(item.month));
    state.fundTransactions.forEach((item) => allMonths.add(item.month));
    state.solTransactions.forEach((item) => allMonths.add(monthFromDate(item.date)));
    allMonths.add(DEFAULT_START_MONTH);
    allMonths.add(currentMonth());

    const sortedMonths = [...allMonths].sort();
    const lastMonth = sortedMonths[sortedMonths.length - 1] ?? currentMonth();
    const series: string[] = [];
    let cursor = DEFAULT_START_MONTH;

    while (cursor <= lastMonth) {
      series.push(cursor);
      cursor = shiftMonth(cursor, 1);
    }

    return series;
  }, [state]);

  const btc = state.fundTransactions.filter((item) => item.fund === "btc").reduce((sum, item) => sum + (item.type === "deposit" ? item.amount : -item.amount), 0);
  const stock = state.fundTransactions.filter((item) => item.fund === "stock").reduce((sum, item) => sum + (item.type === "deposit" ? item.amount : -item.amount), 0);
  const saving = state.bankDeposits.filter((item) => item.fund === "saving").reduce((sum, item) => sum + activePrincipal(item), 0);
  const emergency = state.bankDeposits.filter((item) => item.fund === "emergency").reduce((sum, item) => sum + activePrincipal(item), 0);
  const solVnd = state.solTransactions.reduce((sum, item) => sum + item.solAmount, 0) * state.market.solUsd * state.market.usdVnd;
  const totalAssets = btc + stock + saving + emergency + solVnd;

  const chartData = months.reduce<Array<{ month: string; income: number; expense: number; saving: number; assets: number; withdrawn: number }>>(
    (rows, month) => {
      const summary = monthlySummary(state, month);
      const withdrawn = monthlyWithdrawal(state, month);
      const previousAssets = rows[rows.length - 1]?.assets ?? 0;
    return [
      ...rows,
      {
        month: formatMonth(month),
        income: summary.income,
        expense: summary.expense,
        saving: summary.saving,
        withdrawn,
        assets: Math.max(previousAssets + summary.saving - withdrawn, 0),
      },
    ];
    },
    []
  );

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Báo cáo</p>
          <h1>Tổng tài sản</h1>
        </div>
      </header>
      <section className="metrics-grid">
        <MetricCard label="Tổng tài sản hiện tại" value={formatVnd(totalAssets)} icon={<PiggyBank size={20} />} tone="highlight" />
        <MetricCard label="BTC + CK" value={formatVnd(btc + stock)} icon={<LineChart size={20} />} />
        <MetricCard label="Gốc MBB đang gửi" value={formatVnd(saving + emergency)} icon={<Landmark size={20} />} />
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Tăng trưởng tài sản</h2>
          <small>Hiển thị tổng hiện tại trên dữ liệu đang có</small>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="assetFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#2a2520" />
            <XAxis dataKey="month" stroke="#a59b91" />
            <YAxis stroke="#a59b91" tickFormatter={(value) => `${Math.round(Number(value) / 1_000_000)}M`} />
            <Tooltip content={<GrowthTooltip />} />
            <Area type="monotone" dataKey="assets" stroke="#f97316" fill="url(#assetFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </section>
      <section className="asset-grid">
        <FundChip label="BTC" value={btc} percent={0} />
        <FundChip label="CK" value={stock} percent={0} />
        <FundChip label="SOL quy đổi" value={solVnd} percent={0} />
        <FundChip label="Quỹ tiết kiệm" value={saving} percent={0} />
        <FundChip label="Quỹ dự phòng" value={emergency} percent={0} />
      </section>
    </div>
  );
}

function monthlyWithdrawal(state: AppState, month: string) {
  const fundWithdrawals = state.fundTransactions
    .filter((item) => item.type === "withdraw" && item.month === month)
    .reduce((sum, item) => sum + item.amount, 0);

  const depositSettlements = state.bankDeposits
    .filter((item) => item.settledAt ? monthFromDate(item.settledAt) === month : false)
    .reduce((sum, item) => sum + (item.settledAmount ?? item.principal), 0);

  return fundWithdrawals + depositSettlements;
}

function GrowthTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { month: string; assets: number; withdrawn: number } }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="growth-tooltip">
      <strong>{point.month}</strong>
      <span>
        <em>Tích lũy</em>
        <b>{formatVnd(point.assets)}</b>
      </span>
      <span>
        <em>Số tiền rút</em>
        <b>{formatVnd(point.withdrawn)}</b>
      </span>
    </div>
  );
}

function AdminPage() {
  const cloudConfigured = isCloudSyncConfigured();
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [replacementPin, setReplacementPin] = useState("");
  const [status, setStatus] = useState(cloudConfigured ? "Nhập mật khẩu admin để tiếp tục." : "Thiếu cấu hình Supabase.");
  const [loading, setLoading] = useState(false);

  const unlockAdmin = async () => {
    if (!adminPassword) {
      setStatus("Nhập mật khẩu admin.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Đang kiểm tra mật khẩu admin...");
      const expectedHash = await loadAdminPasswordHash(DEFAULT_ADMIN_PASSWORD_HASH);
      const passwordHash = await sha256Hex(adminPassword);
      if (passwordHash !== expectedHash) {
        setStatus("Mật khẩu admin chưa đúng.");
        return;
      }

      setAdminUnlocked(true);
      setAdminPassword("");
      setStatus("Sẵn sàng quản lý tài khoản PIN.");
    } catch {
      setStatus("Không kiểm tra được mật khẩu admin.");
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async () => {
    if (!cloudConfigured) {
      setStatus("Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (newPin.length < 4) {
      setStatus("PIN mới cần tối thiểu 4 số.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Đang kiểm tra tài khoản...");
      const accountKey = cloudAccountKeyForPin(newPin);
      const existing = await loadCloudState<AppState>(accountKey);
      if (existing) {
        setStatus("PIN này đã có tài khoản. Hãy chọn PIN khác hoặc đổi PIN.");
        return;
      }

      await saveCloudState(accountKey, stateForAccountPin(initialState, newPin));
      setNewPin("");
      setStatus("Đã tạo tài khoản mới. Bạn có thể quay lại app và đăng nhập bằng PIN này.");
    } catch {
      setStatus("Không tạo được tài khoản. Kiểm tra Supabase hoặc kết nối mạng.");
    } finally {
      setLoading(false);
    }
  };

  const changeAccountPin = async () => {
    if (!cloudConfigured) {
      setStatus("Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (oldPin.length < 4 || replacementPin.length < 4) {
      setStatus("PIN cũ và PIN mới cần tối thiểu 4 số.");
      return;
    }
    if (oldPin === replacementPin) {
      setStatus("PIN mới phải khác PIN cũ.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Đang tải dữ liệu tài khoản cũ...");
      const oldKey = cloudAccountKeyForPin(oldPin);
      const oldState = await loadCloudState<AppState>(oldKey);
      if (!oldState) {
        setStatus("Không tìm thấy tài khoản với PIN cũ.");
        return;
      }

      const nextKey = cloudAccountKeyForPin(replacementPin);
      const existingNext = await loadCloudState<AppState>(nextKey);
      if (existingNext) {
        setStatus("PIN mới đã có tài khoản khác. Hãy chọn PIN khác.");
        return;
      }

      const nextState = normalizeState({
        ...initialState,
        ...oldState,
        settings: { ...initialState.settings, ...oldState.settings, hasPin: true, pin: replacementPin },
      });
      await saveCloudState(nextKey, nextState);
      await deleteCloudState(oldKey);
      setOldPin("");
      setReplacementPin("");
      setStatus("Đã đổi PIN. Từ giờ hãy đăng nhập bằng PIN mới.");
    } catch {
      setStatus("Không đổi được PIN. Nếu bạn đã tạo bảng trước đó, hãy chạy lại supabase-schema.sql rồi thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pin-screen">
      <section className="pin-card admin-card">
        <div className="pin-icon">
          <Settings size={26} />
        </div>
        <h1>Admin tài khoản</h1>
        <p>{adminUnlocked ? "Tạo tài khoản PIN mới hoặc đổi PIN cho tài khoản hiện có." : "Đăng nhập admin để quản lý tài khoản PIN."}</p>

        {!adminUnlocked ? (
          <div className="admin-stack">
            <article>
              <h2>Đăng nhập admin</h2>
              <label>
                Mật khẩu admin
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") unlockAdmin();
                  }}
                />
              </label>
              <button className="primary full" disabled={loading} onClick={unlockAdmin}>
                {loading ? "Đang kiểm tra..." : "Đăng nhập admin"}
              </button>
            </article>
          </div>
        ) : (
          <div className="admin-stack">
            <article>
              <h2>Tạo tài khoản</h2>
            <label>
              PIN mới
              <input
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(event) => setNewPin(event.target.value.replace(/\D/g, ""))}
              />
            </label>
            <button className="primary full" disabled={loading || !cloudConfigured} onClick={createAccount}>
              Tạo tài khoản
            </button>
            </article>

            <article>
              <h2>Đổi PIN</h2>
            <label>
              PIN cũ
              <input
                type="password"
                inputMode="numeric"
                value={oldPin}
                onChange={(event) => setOldPin(event.target.value.replace(/\D/g, ""))}
              />
            </label>
            <label>
              PIN mới
              <input
                type="password"
                inputMode="numeric"
                value={replacementPin}
                onChange={(event) => setReplacementPin(event.target.value.replace(/\D/g, ""))}
              />
            </label>
            <button className="primary full" disabled={loading || !cloudConfigured} onClick={changeAccountPin}>
              Đổi PIN
            </button>
            </article>
          </div>
        )}

        <small className={cloudConfigured ? "ok" : "form-error"}>{status}</small>
        <a className="admin-link" href="/">Về app</a>
      </section>
    </main>
  );
}

function SettingsPage({
  state,
  setState,
  cloudSync,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  cloudSync: {
    configured: boolean;
    status: string;
    onSyncNow: () => void;
    onChangePin: (pin: string) => void;
  };
}) {
  const [pin, setPin] = useState("");

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cài đặt</p>
          <h1>Bảo mật và dữ liệu</h1>
        </div>
      </header>
      <section className="two-column compact">
        <article className="panel">
          <div className="panel-title">
            <h2>Mã PIN</h2>
            <small>{state.settings.hasPin ? "Đang bật" : "Chưa bật"}</small>
          </div>
          <div className="form-grid">
            <label>
              PIN mới
              <input type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} />
            </label>
          </div>
          <button
            className="primary"
            onClick={() => {
              if (pin.length < 4) return;
              cloudSync.onChangePin(pin);
              setPin("");
            }}
          >
            <Save size={17} /> Lưu PIN
          </button>
        </article>
        <article className="panel">
          <div className="panel-title">
            <h2>Dữ liệu</h2>
            <small>{cloudSync.configured ? "Supabase" : "Chưa cấu hình"}</small>
          </div>
          <div className="cloud-sync-box">
            <p className="muted">
              Đồng bộ laptop và iPhone bằng Supabase. Mã PIN chính là khóa mở dữ liệu tài khoản trên mọi thiết bị.
            </p>
            <small className={cloudSync.configured ? "ok" : "muted"}>{cloudSync.status}</small>
            <div className="card-actions">
              <button className="primary" disabled={!cloudSync.configured} onClick={cloudSync.onSyncNow}>
                Đồng bộ ngay
              </button>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

export function App() {
  const [state, setState] = useStoredState();
  const [unlocked, setUnlocked] = useState(false);
  const [page, setPage] = useState<Page>("dashboard");
  const [month, setMonth] = useState(currentMonth);
  const [activePin, setActivePin] = useState("");
  const [cloudStatus, setCloudStatus] = useState("");
  const cloudLoaded = useRef(false);
  const lastCloudSnapshot = useRef("");
  const cloudConfigured = isCloudSyncConfigured();
  const cloudAccountKey = activePin ? cloudAccountKeyForPin(activePin) : "";
  const stateForCloud = (): AppState => (activePin ? stateForAccountPin(state, activePin) : state);
  const navigateToPage = (nextPage: Page) => {
    setPage(nextPage);
    if (nextPage === "dashboard") setMonth(currentMonth());
  };

  const unlockWithPin = async (pin: string) => {
    if (!cloudConfigured) {
      if (!state.settings.hasPin) {
        setState((prev) => ({ ...prev, settings: { pin, hasPin: true } }));
        setActivePin(pin);
        setUnlocked(true);
        return null;
      }
      if (pin !== state.settings.pin) return "PIN chưa đúng.";
      setActivePin(pin);
      setUnlocked(true);
      return null;
    }

    try {
      setCloudStatus("Đang mở tài khoản...");
      const accountKey = cloudAccountKeyForPin(pin);
      const cloudState = await loadCloudState<AppState>(accountKey);
      if (!cloudState) return "Tài khoản chưa tồn tại. Vào /admin để tạo PIN.";

      const nextState = normalizeState({
        ...initialState,
        ...cloudState,
        settings: { ...initialState.settings, ...cloudState.settings, hasPin: true, pin },
      });
      setState(nextState);
      setActivePin(pin);
      lastCloudSnapshot.current = JSON.stringify(nextState);
      cloudLoaded.current = true;
      setCloudStatus("Đã mở dữ liệu cloud.");
      setUnlocked(true);
      return null;
    } catch {
      cloudLoaded.current = false;
      setCloudStatus("Không mở được dữ liệu cloud.");
      return "Không mở được tài khoản. Kiểm tra PIN, Supabase hoặc mạng.";
    }
  };

  const changePin = async (pin: string) => {
    if (!activePin) return;
    const previousKey = cloudAccountKeyForPin(activePin);
    const nextKey = cloudAccountKeyForPin(pin);
    const nextState = stateForAccountPin(state, pin);
    setCloudStatus("Đang đổi PIN...");
    setState(nextState);
    setActivePin(pin);
    lastCloudSnapshot.current = JSON.stringify(nextState);
    cloudLoaded.current = true;

    if (!cloudConfigured) {
      setCloudStatus("Đã đổi PIN trên thiết bị này.");
      return;
    }

    try {
      await saveCloudState(nextKey, nextState);
      if (previousKey !== nextKey) await deleteCloudState(previousKey);
      setCloudStatus("Đã đổi PIN và đồng bộ cloud.");
    } catch {
      setCloudStatus("Không đổi được PIN cloud. Vào /admin để đổi PIN lại.");
    }
  };

  const syncCloudNow = async () => {
    if (!cloudConfigured) {
      setCloudStatus("Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (!cloudAccountKey) {
      setCloudStatus("Hãy mở app bằng mã PIN trước.");
      return;
    }
    try {
      setCloudStatus("Đang đồng bộ...");
      const nextSnapshot = stateForCloud();
      await saveCloudState(cloudAccountKey, nextSnapshot);
      lastCloudSnapshot.current = JSON.stringify(nextSnapshot);
      cloudLoaded.current = true;
      setCloudStatus(`Đã đồng bộ ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`);
    } catch {
      setCloudStatus("Không lưu được dữ liệu cloud.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadMarket() {
      try {
        const [solResponse, rateResponse] = await Promise.all([
          fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"),
          fetch("https://open.er-api.com/v6/latest/USD"),
        ]);
        const solJson = await solResponse.json();
        const rateJson = await rateResponse.json();
        const solUsd = Number(solJson?.solana?.usd) || state.market.solUsd;
        const usdVnd = Number(rateJson?.rates?.VND) || state.market.usdVnd;
        if (!cancelled && solUsd && usdVnd) {
          setState((prev) => ({
            ...prev,
            market: {
              solUsd,
              usdVnd,
              updatedAt: new Date().toISOString(),
            },
          }));
        }
      } catch {
        // Keep the latest saved price when the network or API is unavailable.
      }
    }
    loadMarket();
    const timer = window.setInterval(loadMarket, 300_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!cloudConfigured || !cloudAccountKey || !cloudLoaded.current) return;

    const nextSnapshot = stateForCloud();
    const snapshot = JSON.stringify(nextSnapshot);
    if (snapshot === lastCloudSnapshot.current) return;

    setCloudStatus("Đang đồng bộ...");
    const timer = window.setTimeout(async () => {
      try {
        await saveCloudState(cloudAccountKey, nextSnapshot);
        lastCloudSnapshot.current = snapshot;
        setCloudStatus(`Đã đồng bộ ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`);
      } catch {
        setCloudStatus("Không lưu được dữ liệu cloud.");
      }
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [cloudConfigured, cloudAccountKey, state]);

  if (window.location.pathname === "/admin") return <AdminPage />;

  if (!unlocked) return <PinGate state={state} setState={setState} cloudConfigured={cloudConfigured} onUnlock={unlockWithPin} />;

  return (
    <div className="app-shell">
      <AppNav page={page} setPage={navigateToPage} />
      <main className="content">
        {page === "dashboard" && <UnifiedDashboardPage state={state} setState={setState} month={month} setMonth={setMonth} setPage={setPage} />}
        {page === "investment" && <InvestmentPage state={state} setState={setState} />}
        {page === "mbb" && <BankDepositPage state={state} setState={setState} />}
        {page === "reports" && <ReportsPage state={state} />}
      </main>
    </div>
  );
}
