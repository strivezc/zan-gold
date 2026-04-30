const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const METAL_NAMES = {
  gold: "黄金",
  silver: "白银",
  platinum: "铂金",
  palladium: "钯金",
};

exports.main = async (event) => {
  const { openid, alertData } = event;

  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      page: "pages/market/market",
      templateId: event.templateId || "YOUR_TEMPLATE_ID",
      data: {
        thing1: { value: METAL_NAMES[alertData.metal] || alertData.metal },
        number2: { value: alertData.currentPrice.toFixed(2) },
        thing3: {
          value: `${alertData.condition === "above" ? "高于" : "低于"} ¥${alertData.targetPrice}/克`,
        },
        time4: {
          value: new Date().toLocaleString("zh-CN", { hour12: false }),
        },
      },
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
