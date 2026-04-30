/**
 * 交易记录服务 - 买入/卖出 + FIFO成本匹配
 */

const {
  getPositions,
  savePositions,
  getTransactions,
  addTransaction,
} = require("./storage");
const { genId, todayStr } = require("./formatter");

/**
 * 添加买入交易
 * @param {object} params - { metal, pricePerGram, weight, date, note }
 */
function addBuyTransaction({ metal, pricePerGram, weight, date, note }) {
  // 1. 创建持仓记录
  const position = {
    id: genId(),
    metal,
    date: date || todayStr(),
    pricePerGram,
    weight,
    note: note || "",
    createdAt: Date.now(),
  };

  const positions = getPositions();
  positions.push(position);
  savePositions(positions);

  // 2. 记录交易
  const tx = {
    id: genId(),
    type: "buy",
    metal,
    date: date || todayStr(),
    pricePerGram,
    weight,
    note: note || "",
    createdAt: Date.now(),
    realizedPnl: null,
    costBasis: null,
  };
  addTransaction(tx);

  return tx;
}

/**
 * 添加卖出交易 (FIFO成本匹配)
 * @param {object} params - { metal, weight, sellPrice, date, note }
 * @returns {{ tx, realizedPnl, error }}
 */
function addSellTransaction({ metal, weight, sellPrice, date, note }) {
  const positions = getPositions();
  const metalPositions = positions
    .filter((p) => p.metal === metal)
    .sort((a, b) => a.createdAt - b.createdAt); // FIFO: 最早的先卖

  const totalAvailable = metalPositions.reduce((s, p) => s + p.weight, 0);
  if (weight > totalAvailable) {
    return { tx: null, realizedPnl: 0, error: "卖出克数超过持仓" };
  }

  // FIFO匹配
  let remaining = weight;
  let totalRealizedPnl = 0;
  let totalCostBasis = 0;
  let totalCostWeight = 0;

  for (let i = 0; i < metalPositions.length && remaining > 0; i++) {
    const pos = metalPositions[i];
    const sellWeight = Math.min(pos.weight, remaining);
    const pnl = (sellPrice - pos.pricePerGram) * sellWeight;

    totalRealizedPnl += pnl;
    totalCostBasis += pos.pricePerGram * sellWeight;
    totalCostWeight += sellWeight;

    pos.weight -= sellWeight;
    remaining -= sellWeight;

    // 如果该仓位卖完，标记删除
    if (pos.weight <= 0) {
      pos._delete = true;
    }
  }

  // 更新持仓(移除已清空的仓位，更新部分卖出的)
  const updatedPositions = positions.filter((p) => !p._delete);
  savePositions(updatedPositions);

  // 记录交易
  const avgCostBasis = totalCostWeight > 0 ? totalCostBasis / totalCostWeight : 0;
  const tx = {
    id: genId(),
    type: "sell",
    metal,
    date: date || todayStr(),
    pricePerGram: sellPrice,
    weight,
    note: note || "",
    createdAt: Date.now(),
    realizedPnl: parseFloat(totalRealizedPnl.toFixed(2)),
    costBasis: parseFloat(avgCostBasis.toFixed(2)),
  };
  addTransaction(tx);

  return { tx, realizedPnl: totalRealizedPnl, error: null };
}

/**
 * 获取已实现盈亏汇总
 * @returns {{ gold, silver, platinum, palladium, grand }}
 */
function getRealizedPnlSummary() {
  const txs = getTransactions();
  const summary = { gold: 0, silver: 0, platinum: 0, palladium: 0, grand: 0 };

  txs.forEach((tx) => {
    if (tx.type === "sell" && tx.realizedPnl) {
      summary[tx.metal] = (summary[tx.metal] || 0) + tx.realizedPnl;
      summary.grand += tx.realizedPnl;
    }
  });

  // 保留2位小数避免浮点误差
  Object.keys(summary).forEach((k) => {
    summary[k] = parseFloat(summary[k].toFixed(2));
  });

  return summary;
}

module.exports = {
  addBuyTransaction,
  addSellTransaction,
  getRealizedPnlSummary,
};
