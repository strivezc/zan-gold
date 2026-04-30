/**
 * 数据持久化模块 - 所有本地存储读写的唯一入口
 * 后续云同步将在此模块末尾透明接入
 */

const POSITIONS_KEY = "positions";
const TRANSACTIONS_KEY = "transactions";
const ALERTS_KEY = "alerts";
const SETTINGS_KEY = "appSettings";

// ========== 持仓 ==========

function getPositions() {
  return wx.getStorageSync(POSITIONS_KEY) || [];
}

function savePositions(positions) {
  wx.setStorageSync(POSITIONS_KEY, positions);
  _notifyChange();
}

function addPosition(position) {
  const list = getPositions();
  list.push(position);
  savePositions(list);
}

function deletePosition(id) {
  const list = getPositions().filter((p) => p.id !== id);
  savePositions(list);
}

function updatePosition(id, changes) {
  const list = getPositions().map((p) =>
    p.id === id ? { ...p, ...changes } : p,
  );
  savePositions(list);
}

// ========== 交易记录 ==========

function getTransactions() {
  return wx.getStorageSync(TRANSACTIONS_KEY) || [];
}

function saveTransactions(txs) {
  wx.setStorageSync(TRANSACTIONS_KEY, txs);
  _notifyChange();
}

function addTransaction(tx) {
  const list = getTransactions();
  list.push(tx);
  saveTransactions(list);
}

// ========== 价格预警 ==========

function getAlerts() {
  return wx.getStorageSync(ALERTS_KEY) || [];
}

function saveAlerts(alerts) {
  wx.setStorageSync(ALERTS_KEY, alerts);
  _notifyChange();
}

function addAlert(alert) {
  const list = getAlerts();
  list.push(alert);
  saveAlerts(list);
}

function deleteAlert(id) {
  const list = getAlerts().filter((a) => a.id !== id);
  saveAlerts(list);
}

function updateAlert(id, changes) {
  const list = getAlerts().map((a) =>
    a.id === id ? { ...a, ...changes } : a,
  );
  saveAlerts(list);
}

// ========== 设置 ==========

function getSettings() {
  return wx.getStorageSync(SETTINGS_KEY) || { themeMode: "light" };
}

function saveSettings(settings) {
  wx.setStorageSync(SETTINGS_KEY, settings);
  _notifyChange();
}

// ========== 数据变更通知 (云同步钩子) ==========

let _changeTimer = null;
let _cloudService = null;

function setCloudService(service) {
  _cloudService = service;
}

function _notifyChange() {
  // 立即记录时间戳(确保合并时本地数据不会被云端覆盖)
  wx.setStorageSync("localUpdatedAt", Date.now());
  // 云同步走防抖
  if (!_cloudService) return;
  if (_changeTimer) clearTimeout(_changeTimer);
  _changeTimer = setTimeout(() => {
    _cloudService.onDataChanged && _cloudService.onDataChanged();
  }, 2000);
}

// ========== 旧数据迁移 ==========

function migrateOldData() {
  const positions = getPositions();
  if (positions.length > 0) return; // 已有新数据，跳过迁移

  const oldGoldWeight = wx.getStorageSync("goldWeight");
  const oldGoldCost = wx.getStorageSync("goldCost");
  const oldSilverWeight = wx.getStorageSync("silverWeight");
  const oldSilverCost = wx.getStorageSync("silverCost");

  const migrated = [];
  const today = new Date().toISOString().slice(0, 10);

  if (oldGoldWeight && parseFloat(oldGoldWeight) > 0) {
    migrated.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      metal: "gold",
      date: today,
      pricePerGram: oldGoldCost ? parseFloat(oldGoldCost) : 0,
      weight: parseFloat(oldGoldWeight),
      note: "旧数据迁移",
      createdAt: Date.now(),
    });
  }

  if (oldSilverWeight && parseFloat(oldSilverWeight) > 0) {
    migrated.push({
      id:
        (Date.now() + 1).toString(36) +
        Math.random().toString(36).slice(2, 6),
      metal: "silver",
      date: today,
      pricePerGram: oldSilverCost ? parseFloat(oldSilverCost) : 0,
      weight: parseFloat(oldSilverWeight),
      note: "旧数据迁移",
      createdAt: Date.now() + 1,
    });
  }

  if (migrated.length > 0) {
    savePositions(migrated);
    // 清除旧key
    wx.removeStorageSync("goldWeight");
    wx.removeStorageSync("goldCost");
    wx.removeStorageSync("silverWeight");
    wx.removeStorageSync("silverCost");
    wx.removeStorageSync("intlGoldOzInput");
    wx.removeStorageSync("domesticRateInput");
  }
}

module.exports = {
  getPositions,
  savePositions,
  addPosition,
  deletePosition,
  updatePosition,
  getTransactions,
  saveTransactions,
  addTransaction,
  getAlerts,
  saveAlerts,
  addAlert,
  deleteAlert,
  updateAlert,
  getSettings,
  saveSettings,
  setCloudService,
  migrateOldData,
};
