import {
  getSettings,
  saveSettings,
  getAlerts,
  addAlert,
  deleteAlert,
  updateAlert,
} from "../../utils/storage";
import { clearHistory } from "../../utils/priceHistory";
import { createAlert, requestAlertPermission } from "../../utils/alertService";

const app = getApp();

const METAL_NAMES = {
  gold: "黄金",
  silver: "白银",
  platinum: "铂金",
  palladium: "钯金",
};

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
    const raw = getAlerts();
    const formatted = raw.map((a) => {
      let _status = "待触发";
      if (a.lastTriggeredAt) {
        const d = new Date(a.lastTriggeredAt);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const mi = String(d.getMinutes()).padStart(2, "0");
        _status = `已触发 ${mm}-${dd} ${hh}:${mi}`;
      }
      return { ...a, _status };
    });
    this.setData({ alerts: formatted });
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
    this.setData({
      alertCondition: e.detail.value === "0" ? "above" : "below",
    });
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

    // 已有预警时提示
    const existing = getAlerts();
    if (existing.length > 0) {
      const cont = await new Promise((resolve) => {
        wx.showModal({
          title: "替换预警",
          content: "已有预警将被删除，微信每次只能授权一条通知推送。确定替换？",
          confirmText: "替换",
          cancelText: "取消",
          success: (res) => resolve(res.confirm),
        });
      });
      if (!cont) return;
      existing.forEach((a) => deleteAlert(a.id));
    }

    // 添加时请求一次性订阅权限(用户点击触发，可弹授权窗)
    const granted = await requestAlertPermission();
    if (!granted) {
      wx.showToast({
        title: "未授权通知，预警仅在小程序内提示",
        icon: "none",
        duration: 2000,
      });
    }

    const alert = createAlert({
      metal: alertMetal,
      condition: alertCondition,
      targetPrice: price,
    });
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
      content:
        "金攒攒 - 贵金属投资管理工具\n\n实时追踪金银铂钯价格\n多笔持仓管理与盈亏计算\n数据云同步\n价格预警通知\n\nVersion 1.0.0",
      showCancel: false,
    });
  },
});
