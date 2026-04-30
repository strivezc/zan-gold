/**
 * 价格预警服务
 * 检查当前价格是否触发预警条件，通过云函数发送订阅消息
 */

const { getAlerts, updateAlert } = require("./storage");
const { genId } = require("./formatter");

const COOLDOWN_MS = 60 * 60 * 1000; // 1小时内不重复提醒

/**
 * 检查所有预警是否触发
 * @param {Array} alerts - 预警列表
 * @param {object} prices - 当前价格数据
 * @returns {Array} 触发的预警列表
 */
function checkAlerts(alerts, prices) {
  if (!alerts || !prices) return [];

  const now = Date.now();
  const triggered = [];

  alerts.forEach((alert) => {
    if (!alert.enabled) return;
    if (alert.lastTriggeredAt && now - alert.lastTriggeredAt < COOLDOWN_MS) return;

    const priceData = prices[alert.metal];
    if (!priceData || !priceData.price_g) return;

    const currentPrice = parseFloat(priceData.price_g);
    let hit = false;

    if (alert.condition === "above" && currentPrice >= alert.targetPrice) {
      hit = true;
    } else if (alert.condition === "below" && currentPrice <= alert.targetPrice) {
      hit = true;
    }

    if (hit) {
      triggered.push({ ...alert, currentPrice });
    }
  });

  return triggered;
}

/**
 * 请求订阅消息权限
 * @returns {boolean} 是否授权成功
 */
function requestAlertPermission() {
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: ["Bhm52obkft_ObqRpVlt552bCRo9-0nen3g_Ut5moFYo"], // 需替换为实际模板ID
      success: () => resolve(true),
      fail: () => resolve(false),
    });
  });
}

/**
 * 处理触发的预警 — 直接发送通知(权限在添加预警时已获取)
 * @param {Array} triggeredAlerts
 */
async function handleTriggeredAlerts(triggeredAlerts) {
  for (const alert of triggeredAlerts) {
    // 标记已触发(避免重复提醒)
    updateAlert(alert.id, { lastTriggeredAt: Date.now() });

    // 直接调用云函数发送通知(无需用户交互，权限已在添加时获取)
    try {
      const res = await wx.cloud.callFunction({
        name: "sendAlert",
        data: {
          alertData: {
            metal: alert.metal,
            currentPrice: alert.currentPrice,
            condition: alert.condition,
            targetPrice: alert.targetPrice,
          },
          templateId: "Bhm52obkft_ObqRpVlt552bCRo9-0nen3g_Ut5moFYo",
        },
      });
      console.log("[alert] 通知发送成功:", res.result);
    } catch (err) {
      console.error("[alert] 通知发送失败:", err);
    }
  }
}

/**
 * 创建新预警
 * @param {object} params - { metal, condition, targetPrice }
 * @returns {object} 预警对象
 */
function createAlert({ metal, condition, targetPrice }) {
  return {
    id: "alert-" + genId(),
    metal,
    condition,
    targetPrice,
    enabled: true,
    lastTriggeredAt: null,
    createdAt: Date.now(),
  };
}

module.exports = {
  checkAlerts,
  requestAlertPermission,
  handleTriggeredAlerts,
  createAlert,
};
