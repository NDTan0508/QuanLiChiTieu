export type StockOpenPositionInput = {
  cashVnd: number;
  holdingsCostVnd: number;
  holdingsMarketValueVnd: number;
  totalAssetAdjustmentVnd?: number;
};

export type StockOpenPositionResult = {
  investedValueVnd: number;
  currentValueVnd: number;
  pnlVnd: number;
  pnlPercent: number;
};

const safeAmount = (value: number | undefined) =>
  Number.isFinite(value) ? Math.max(value ?? 0, 0) : 0;

export function stockOpenPositionSnapshot(input: StockOpenPositionInput): StockOpenPositionResult {
  const cashVnd = safeAmount(input.cashVnd);
  const holdingsCostVnd = safeAmount(input.holdingsCostVnd);
  const holdingsMarketValueVnd = safeAmount(input.holdingsMarketValueVnd);
  const investedValueVnd = cashVnd + holdingsCostVnd;
  const activeValueBeforeAdjustment = cashVnd + holdingsMarketValueVnd;
  const currentValueVnd =
    investedValueVnd > 0 || activeValueBeforeAdjustment > 0
      ? Math.max(activeValueBeforeAdjustment + (input.totalAssetAdjustmentVnd ?? 0), 0)
      : 0;
  const pnlVnd = currentValueVnd - investedValueVnd;

  return {
    investedValueVnd,
    currentValueVnd,
    pnlVnd,
    pnlPercent: investedValueVnd ? (pnlVnd / investedValueVnd) * 100 : 0,
  };
}

export function realizedStockSalePnl(netProceedsVnd: number, releasedCostVnd: number) {
  const proceeds = Number.isFinite(netProceedsVnd) ? netProceedsVnd : 0;
  const cost = Number.isFinite(releasedCostVnd) ? releasedCostVnd : 0;
  return proceeds - cost;
}
