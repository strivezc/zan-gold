import { getSettings, saveSettings, getAlerts, addAlert, deleteAlert, updateAlert } from "../../utils/storage";
import { clearHistory } from "../../utils/priceHistory";
import { createAlert, requestAlertPermission } from "../../utils/alertService";

const app = getApp();

const METAL_NAMES = { gold: "黄金", silver: "白银", platinum: "铂金", palladium: "钯金" };

Page({
  data: {
    themeMode: "system",
    isDark: false,
    historyDataSize: "--",
    alerts: [],
    showAlertSheet: false,
    alertMetal: "gold",
    alertCondition: "above",
    alertPrice: "",
    metalNames: METAL_NAMES,
  },

  onShow() {
    this.setData({ isDark: app.globalData.isDark || false });
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ active: 3 });
    }
    this._loadSettings();
    this._calcHistorySize();
    this._loadAlerts();
  },

  _loadSettings() {
    const settings = getSettings();
    this.setData({ themeMode: settings.themeMode || "system" });
  },

  _loadAlerts() {
    this.setData({ alerts: getAlerts() });
  },

  _calcHistorySize() {
    try {
      const data = wx.getStorageSync("priceHistory");
      if (data) {
        const size = JSON.stringify(data).length;
        this.setData({ historyDataSize: (size / 1024).toFixed(1) + " KB" });
      } else {
        this.setData({ historyDataSize: "0 KB" });
      }
    } catch (e) {
      this.setData({ historyDataSize: "--" });
    }
  },

  // ========== 主题切换 ==========

  onThemeChange(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ themeMode: mode });
    const settings = getSettings();
    settings.themeMode = mode;
    saveSettings(settings);
    app.applyTheme(mode);
    this.setData({ isDark: app.globalData.isDark || false });
  },

  // ========== 价格预警 ==========

  onShowAlertSheet() {
    this.setData({
      showAlertSheet: true,
      alertMetal: "gold",
      alertCondition: "above",
      alertPrice: "",
    });
  },

  onHideAlertSheet() {
    this.setData({ showAlertSheet: false });
  },

  onAlertMetalChange(e) {
    const metals = ["gold", "silver", "platinum", "palladium"];
    this.setData({ alertMetal: metals[e.detail.value] });
  },

  onAlertConditionChange(e) {
    this.setData({ alertCondition: e.detail.value === "0" ? "above" : "below" });
  },

  onAlertPriceInput(e) {
    this.setData({ alertPrice: e.detail.value });
  },

  async onConfirmAlert() {
    const { alertMetal, alertCondition, alertPrice } = this.data;
    const price = parseFloat(alertPrice);

    if (!price || price <= 0) {
      wx.showToast({ title: "请输入目标价格", icon: "none" });
      return;
    }

    // 请求通知权限
    const granted = await requestAlertPermission();
    if (!granted) {
      wx.showToast({ title: "需要通知权限才能发送提醒", icon: "none" });
    }

    const alert = createAlert({ metal: alertMetal, condition: alertCondition, targetPrice: price });
    addAlert(alert);
    this.setData({ showAlertSheet: false });
    this._loadAlerts();
    wx.showToast({ title: "预警已添加", icon: "success" });
  },

  onToggleAlert(e) {
    const id = e.currentTarget.dataset.id;
    const alert = this.data.alerts.find((a) => a.id === id);
    if (alert) {
      updateAlert(id, { enabled: !alert.enabled });
      this._loadAlerts();
    }
  },

  onDeleteAlert(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "删除预警",
      content: "确定要删除这条价格预警吗？",
      confirmColor: "#ff3b30",
      success: (res) => {
        if (res.confirm) {
          deleteAlert(id);
          this._loadAlerts();
        }
      },
    });
  },

  // ========== 清除数据 ==========

  onClearHistory() {
    wx.showModal({
      title: "清除价格历史",
      content: "将删除所有已记录的价格走势数据，此操作不可恢复。",
      confirmColor: "#ff3b30",
      success: (res) => {
        if (res.confirm) {
          clearHistory();
          this._calcHistorySize();
          wx.showToast({ title: "已清除", icon: "success" });
        }
      },
    });
  },

  onClearAll() {
    wx.showModal({
      title: "清除所有数据",
      content: "将删除所有持仓、交易记录和价格历史。此操作不可恢复！",
      confirmColor: "#ff3b30",
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          wx.showToast({ title: "已清除全部数据", icon: "success" });
          setTimeout(() => {
            wx.reLaunch({ url: "/pages/market/market" });
          }, 1000);
        }
      },
    });
  },

  onAbout() {
    wx.showModal({
      title: "关于 ZAN GOLD",
      content: "金攒攒 - 贵金属投资管理工具\n\n实时追踪金银铂钯价格\n多笔持仓管理与盈亏计算\n数据云同步\n价格预警通知\n\nVersion 2.0",
      showCancel: false,
    });
  },
});
