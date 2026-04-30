/**
 * 纯计算模块 - 无副作用，无存储访问
 * 所有持仓/盈亏计算逻辑集中于此
 */

/**
 * 计算同一金属的加权均价
 * @param {Array} positions - 同一金属的持仓数组
 * @returns {number} 加权均价 (CNY/g)
 */
function calcWeightedAvgCost(positions) {
  if (!positions || positions.length === 0) return 0;
  let totalCost = 0;
  let totalWeight = 0;
  positions.forEach((p) => {
    totalCost += p.pricePerGram * p.weight;
    totalWeight += p.weight;
  });
  return totalWeight > 0 ? totalCost / totalWeight : 0;
}

/**
 * 计算指定金属的总克数
 * @param {Array} positions - 全部持仓
 * @param {string} metal - 金属类型
 * @returns {number}
 */
function calcTotalWeight(positions, metal) {
  return positions
    .filter((p) => p.metal === metal)
    .reduce((sum, p) => sum + p.weight, 0);
}

/**
 * 计算未实现盈亏
 * @param {Array} positions - 同一金属的持仓
 * @param {number} currentPrice - 当前价格 (CNY/g)
 * @returns {{ pnl: number, pnlRate: number }}
 */
function calcUnrealizedPnl(positions, currentPrice) {
  if (!positions || positions.length === 0 || !currentPrice) {
    return { pnl: 0, pnlRate: 0 };
  }
  let totalCost = 0;
  let totalValue = 0;
  positions.forEach((p) => {
    totalCost += p.pricePerGram * p.weight;
    totalValue += currentPrice * p.weight;
  });
  const pnl = totalValue - totalCost;
  const pnlRate = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  return { pnl, pnlRate };
}

/**
 * 计算完整持仓摘要
 * @param {Array} positions - 全部持仓
 * @param {object} prices - { gold: {price_g}, silver: {price_g}, ... }
 * @returns {object} 摘要数据
 */
function calcPortfolioSummary(positions, prices) {
  const metals = ["gold", "silver", "platinum", "palladium"];
  const result = {};
  let grandTotal = 0;
  let totalPnl = 0;

  metals.forEach((metal) => {
    const metalPositions = positions.filter((p) => p.metal === metal);
    const weight = calcTotalWeight(positions, metal);
    const avgCost = calcWeightedAvgCost(metalPositions);
    const currentPrice = prices && prices[metal] ? parseFloat(prices[metal].price_g) : 0;
    const totalValue = currentPrice * weight;
    const { pnl, pnlRate } = calcUnrealizedPnl(metalPositions, currentPrice);

    result[metal] = {
      weight,
      avgCost,
      currentPrice,
      totalValue,
      pnl,
      pnlRate,
      positions: metalPositions,
    };

    grandTotal += totalValue;
    totalPnl += pnl;
  });

  return { ...result, grandTotal, totalPnl };
}

module.exports = {
  calcWeightedAvgCost,
  calcTotalWeight,
  calcUnrealizedPnl,
  calcPortfolioSummary,
};
