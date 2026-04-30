/**
 * 微信云同步服务
 * 需在 app.json 中配置云环境，用户需在微信开发者工具中开通云开发
 */

const SYNC_KEY = "user_data";
let _db = null;
let _syncTimer = null;

function _getDb() {
  if (!_db && wx.cloud) {
    _db = wx.cloud.database();
  }
  return _db;
}

/**
 * 从云端拉取数据
 * @returns {object|null} 云端数据或null
 */
async function syncFromCloud() {
  const db = _getDb();
  if (!db) return null;

  try {
    const { data } = await db
      .collection(SYNC_KEY)
      .where({}) // _openid 自动过滤
      .limit(1)
      .get();

    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error("云端拉取失败:", err);
    return null;
  }
}

/**
 * 推送数据到云端(防抖)
 * @param {object} payload - { positions, transactions, alerts, settings }
 */
function syncToCloud(payload) {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => _doSync(payload), 2000);
}

async function _doSync(payload) {
  const db = _getDb();
  if (!db) return;

  const doc = {
    ...payload,
    updatedAt: Date.now(),
    version: 2,
  };

  try {
    const existing = await syncFromCloud();
    if (existing) {
      await db
        .collection(SYNC_KEY)
        .doc(existing._id)
        .update({ data: doc });
    } else {
      await db.collection(SYNC_KEY).add({ data: doc });
    }
  } catch (err) {
    console.error("云端同步失败:", err);
  }
}

/**
 * 合并本地和云端数据
 * @param {object} local - 本地数据
 * @param {object} cloud - 云端数据
 * @returns {object} 合并后的数据
 */
function mergeData(local, cloud) {
  if (!cloud) return local;
  if (!local) return cloud;

  // 按 updatedAt 决定整体偏好
  const cloudIsNewer = (cloud.updatedAt || 0) > (local.updatedAt || 0);

  // positions 和 transactions 按 id 去重合并
  const mergedPositions = _mergeArraysById(
    local.positions || [],
    cloud.positions || [],
    cloudIsNewer,
  );
  const mergedTransactions = _mergeArraysById(
    local.transactions || [],
    cloud.transactions || [],
    cloudIsNewer,
  );

  return {
    positions: mergedPositions,
    transactions: mergedTransactions,
    alerts: cloudIsNewer ? (cloud.alerts || local.alerts || []) : (local.alerts || cloud.alerts || []),
    settings: cloudIsNewer ? (cloud.settings || local.settings || {}) : (local.settings || cloud.settings || {}),
    updatedAt: Math.max(local.updatedAt || 0, cloud.updatedAt || 0),
  };
}

function _mergeArraysById(localArr, cloudArr, preferCloud) {
  const map = {};
  // 先放本地
  localArr.forEach((item) => {
    map[item.id] = item;
  });
  // 再放云端(如果偏好云端则覆盖，否则保留本地)
  cloudArr.forEach((item) => {
    if (!map[item.id] || preferCloud) {
      map[item.id] = item;
    }
  });
  return Object.values(map);
}

/**
 * 数据变更回调(由 storage.js 调用)
 */
function onDataChanged() {
  // 由 app.js 注入实际逻辑
}

module.exports = {
  syncFromCloud,
  syncToCloud,
  mergeData,
  onDataChanged,
};
