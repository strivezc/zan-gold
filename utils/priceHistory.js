/**
 * 价格历史记录模块 - Phase 4 完整实现
 * 当前为占位版本，提供基本接口供 market.js 调用
 */

const HISTORY_KEY = "priceHistory";
const MAX_RAW_POINTS = 2880; // 24h × 120次/小时

function recordSnapshot(prices) {
  if (!prices) return;

  const history = wx.getStorageSync(HISTORY_KEY) || {};
  const now = Date.now();

  const metals = ["gold", "silver", "platinum", "palladium"];
  metals.forEach((metal) => {
    if (!prices[metal] || !prices[metal].price_g) return;

    if (!history[metal]) {
      history[metal] = { raw: [], fiveMin: [], hourly: [] };
    }

    history[metal].raw.push({
      t: now,
      p: parseFloat(prices[metal].price_g),
    });

    // 超过上限时裁剪旧数据
    if (history[metal].raw.length > MAX_RAW_POINTS) {
      history[metal].raw = history[metal].raw.slice(-MAX_RAW_POINTS);
    }
  });

  history.lastRecordAt = now;
  wx.setStorageSync(HISTORY_KEY, history);
}

function getHistoryData(metal, range) {
  const history = wx.getStorageSync(HISTORY_KEY) || {};
  const metalData = history[metal];
  if (!metalData) return { timestamps: [], prices: [] };

  const now = Date.now();
  let points;

  switch (range) {
    case "1d":
      points = metalData.raw || [];
      // 只取最近24小时
      points = points.filter((p) => now - p.t < 24 * 60 * 60 * 1000);
      break;
    case "1w":
      points = metalData.fiveMin && metalData.fiveMin.length > 0
        ? metalData.fiveMin
        : (metalData.raw || []).filter((p) => now - p.t < 7 * 24 * 60 * 60 * 1000);
      break;
    case "1m":
      points = metalData.hourly && metalData.hourly.length > 0
        ? metalData.hourly
        : (metalData.raw || []).filter((p) => now - p.t < 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      points = metalData.raw || [];
  }

  return {
    timestamps: points.map((p) => p.t),
    prices: points.map((p) => p.p),
  };
}

function clearHistory() {
  wx.removeStorageSync(HISTORY_KEY);
}

module.exports = { recordSnapshot, getHistoryData, clearHistory };
