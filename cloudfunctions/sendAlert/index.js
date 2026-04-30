const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const METAL_NAMES = {
  gold: "黄金",
  silver: "白银",
  platinum: "铂金",
  palladium: "钯金",
};

exports.main = async (event) => {
  const { alertData } = event;
  const { OPENID: openid } = cloud.getWXContext();

  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      page: "pages/market/market",
      templateId: event.templateId || "Bhm52obkft_ObqRpVlt552bCRo9-0nen3g_Ut5moFYo",
      data: {
        short_thing5: { value: METAL_NAMES[alertData.metal] + "预警" },
        amount6: { value: alertData.currentPrice.toFixed(2) },
        time4: {
          value: new Date().toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" }),
        },
      },
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
