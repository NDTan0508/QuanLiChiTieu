import {
  FINANCIAL_SCHEMA_VERSION,
  stableEventId,
  stableGroupId,
  type TransactionMeta,
} from "./financialTypes";

export const MBB_SETTLEMENT_INCOME_CATEGORY_ID = "mbb-settlement-income";
export const MBB_SETTLEMENT_INCOME_CATEGORY_NAME = "Tất toán sổ MBB";
export const MBB_SETTLEMENT_INCOME_SCHEMA_VERSION = 3;

export type MbbSettlementDeposit = {
  id: string;
  code?: string;
  mbLast4?: string;
  principal: number;
  status: string;
  settledAt?: string;
  settledAmount?: number;
  childId?: string;
};

export type MbbSettlementIncomeCategory = {
  id: string;
  name: string;
  kind: "variable";
};

export type MbbSettlementIncomeTransaction = {
  id: string;
  categoryId: string;
  amount: number;
  date: string;
  month: string;
  note: string;
  meta: TransactionMeta;
};

export const mbbSettlementIncomeCategory = (): MbbSettlementIncomeCategory => ({
  id: MBB_SETTLEMENT_INCOME_CATEGORY_ID,
  name: MBB_SETTLEMENT_INCOME_CATEGORY_NAME,
  kind: "variable",
});

export const mbbSettlementIncomeId = (depositId: string) => `mbb-settlement-income:${depositId}`;

export function realizedMbbDepositInterest(deposit: MbbSettlementDeposit) {
  if (deposit.status === "early-settled") return 0;
  const principal = Number.isFinite(deposit.principal) ? deposit.principal : 0;
  const received = Number.isFinite(deposit.settledAmount) ? deposit.settledAmount ?? principal : principal;
  return Math.max(Math.round(received - principal), 0);
}

export function isIncomeGeneratingMbbSettlement(deposit: MbbSettlementDeposit) {
  return (deposit.status === "settled" || deposit.status === "early-settled") && Boolean(deposit.settledAt) && !deposit.childId;
}

export function makeMbbSettlementIncome(
  deposit: MbbSettlementDeposit,
  createdBy: TransactionMeta["createdBy"] = "user"
): MbbSettlementIncomeTransaction {
  const id = mbbSettlementIncomeId(deposit.id);
  const date = deposit.settledAt ?? new Date().toISOString().slice(0, 10);
  const amount = Number.isFinite(deposit.settledAmount) ? deposit.settledAmount ?? deposit.principal : deposit.principal;
  const suffix = deposit.mbLast4 ? ` ${deposit.mbLast4}` : "";
  const occurredAt = `${date}T00:00:00.000Z`;

  return {
    id,
    categoryId: MBB_SETTLEMENT_INCOME_CATEGORY_ID,
    amount: Math.max(Math.round(amount), 0),
    date,
    month: date.slice(0, 7),
    note: `Tất toán sổ MBB ${deposit.code ?? deposit.id}${suffix}`,
    meta: {
      eventId: stableEventId("income", id),
      groupId: stableGroupId("mbb-settlement", deposit.id),
      parentEventIds: [stableEventId("deposit", deposit.id)],
      childEventIds: [],
      accountFromId: "mbb-books",
      accountToId: "mb-payment",
      createdAt: occurredAt,
      updatedAt: occurredAt,
      createdBy,
      schemaVersion: FINANCIAL_SCHEMA_VERSION,
    },
  };
}

export function appendMbbSettlementIncome<TCategory extends { id: string }, TIncome extends { id: string }>(
  incomeCategories: TCategory[],
  incomeTransactions: TIncome[],
  deposit: MbbSettlementDeposit,
  createdBy: TransactionMeta["createdBy"] = "user"
) {
  const category = mbbSettlementIncomeCategory();
  const transaction = makeMbbSettlementIncome(deposit, createdBy);
  return {
    incomeCategories: incomeCategories.some((item) => item.id === category.id)
      ? incomeCategories
      : [...incomeCategories, category as unknown as TCategory],
    incomeTransactions: incomeTransactions.some((item) => item.id === transaction.id)
      ? incomeTransactions
      : [...incomeTransactions, transaction as unknown as TIncome],
  };
}

export function migrateMbbSettlementIncome<TCategory extends { id: string }, TIncome extends { id: string }>(
  incomeCategories: TCategory[],
  incomeTransactions: TIncome[],
  deposits: MbbSettlementDeposit[]
) {
  let nextCategories = incomeCategories;
  let nextTransactions = incomeTransactions;
  const category = mbbSettlementIncomeCategory();
  if (!nextCategories.some((item) => item.id === category.id)) {
    nextCategories = [...nextCategories, category as unknown as TCategory];
  }

  deposits.filter(isIncomeGeneratingMbbSettlement).forEach((deposit) => {
    const transaction = makeMbbSettlementIncome(deposit, "migration");
    if (!nextTransactions.some((item) => item.id === transaction.id)) {
      nextTransactions = [...nextTransactions, transaction as unknown as TIncome];
    }
  });

  return { incomeCategories: nextCategories, incomeTransactions: nextTransactions };
}
