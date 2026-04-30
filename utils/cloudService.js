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
 * @param {boolean} immediate - 是否立即同步(不走防抖)
 */
function syncToCloud(payload, immediate) {
  if (_syncTimer) clearTimeout(_syncTimer);
  if (immediate) {
    _doSync(payload);
  } else {
    _syncTimer = setTimeout(() => _doSync(payload), 2000);
  }
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

  const localTime = local.updatedAt || 0;
  const cloudTime = cloud.updatedAt || 0;
  const localIsEmpty = (local.positions || []).length === 0 && (local.transactions || []).length === 0;
  const cloudIsNewer = cloudTime > localTime;

  // 本地为空(新安装) → 用云端数据
  if (localIsEmpty) return cloud;

  // 本地更新 → 以本地为准(删除操作不会被云端覆盖)
  if (!cloudIsNewer) return local;

  // 云端更新 → 合并双方(按id去重，云端优先)
  const mergedPositions = _mergeArraysById(local.positions || [], cloud.positions || [], true);
  const mergedTransactions = _mergeArraysById(local.transactions || [], cloud.transactions || [], true);

  return {
    positions: mergedPositions,
    transactions: mergedTransactions,
    alerts: cloud.alerts || local.alerts || [],
    settings: cloud.settings || local.settings || {},
    updatedAt: cloudTime,
  };
}

function _mergeArraysById(localArr, cloudArr, preferCloud) {
  const map = {};
  // 先放本地
  localArr.forEach((item) => {
    map[item.id] = item;
  });
  // 云端数据：只在偏好云端时合并(本地更新时，云端多出的条目视为已删除)
  cloudArr.forEach((item) => {
    if (preferCloud) {
      map[item.id] = item;
    } else if (map[item.id]) {
      // 本地更新，保留本地版本(不添加云端多出的条目)
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
