import { fetchLivePrices } from "../../utils/goldService";
import { animateNumber } from "../../utils/formatter";
import { recordSnapshot } from "../../utils/priceHistory";
import { getAlerts } from "../../utils/storage";
import { checkAlerts, handleTriggeredAlerts } from "../../utils/alertService";

const app = getApp();

Page({
  data: {
    prices: null,
    loading: false,
    lastUpdate: "",

    displayGoldPrice: "0.00",
    displaySilverPrice: "0.00",
    currentGoldPrice: 0,
    currentSilverPrice: 0,

    // 国际金价换算
    intlGoldOzInput: "",
    domesticRateInput: "",
    domesticGoldResult: "--",
    isRateManuallyEdited: false,

    // 金银比
    goldSilverRatio: "--",

    isDark: false,
  },

  // ========== 生命周期 ==========

  onLoad() {
    this.setData({ isDark: app.globalData.isDark || false });
    this._restoreConverterInputs();
    this.refreshPrices();
  },

  onShow() {
    this.setData({ isDark: app.globalData.isDark || false });
    // 更新tabBar激活状态
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ active: 0 });
    }
    if (!this._interval) {
      this.refreshPrices();
      this._startAutoRefresh();
    }
  },

  onHide() {
    this._stopAutoRefresh();
  },

  onUnload() {
    this._stopAutoRefresh();
  },

  onPullDownRefresh() {
    this.refreshPrices();
  },

  // ========== 数据刷新 ==========

  async refreshPrices() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const data = await fetchLivePrices();
      // 共享价格数据给其他页面(持仓页等)
      app.globalData.prices = data;

      const updatedData = {
        prices: data,
        lastUpdate: data.lastUpdate || "",
      };

      // 自动填充换算器(仅未手动编辑时)
      if (!this.data.intlGoldOzInput && data.gold && data.gold.price_oz) {
        updatedData.intlGoldOzInput = String(data.gold.price_oz);
      }
      if (!this.data.isRateManuallyEdited && data.exchangeRate) {
        updatedData.domesticRateInput = String(data.exchangeRate);
      }

      // 金银比
      if (data.goldSilverRatio) {
        updatedData.goldSilverRatio = data.goldSilverRatio;
      }

      this.setData(updatedData, () => {
        this.calculateDomesticGoldPrice();
      });

      // 价格跳动动画
      if (data.gold) {
        const newPrice = parseFloat(data.gold.price_g);
        animateNumber(this, "displayGoldPrice", this.data.currentGoldPrice, newPrice);
        this.setData({ currentGoldPrice: newPrice });
      }
      if (data.silver) {
        const newPrice = parseFloat(data.silver.price_g);
        animateNumber(this, "displaySilverPrice", this.data.currentSilverPrice, newPrice);
        this.setData({ currentSilverPrice: newPrice });
      }

      // 记录价格快照(供图表使用)
      recordSnapshot(data);

      // 检查价格预警
      const alerts = getAlerts();
      const triggered = checkAlerts(alerts, data);
      if (triggered.length > 0) {
        console.log("[alert] 触发预警:", triggered.map(a => `${a.metal} ${a.condition} ${a.targetPrice}`));
        handleTriggeredAlerts(triggered);
      }
    } catch (err) {
      console.error("刷新异常:", err);
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  _startAutoRefresh() {
    this._stopAutoRefresh();
    this._interval = setInterval(() => this.refreshPrices(), 30000);
  },

  _stopAutoRefresh() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  },

  // ========== 国际金价换算 ==========

  calculateDomesticGoldPrice() {
    const oz = parseFloat(this.data.intlGoldOzInput);
    const rate = parseFloat(this.data.domesticRateInput);
    if (isNaN(oz) || oz <= 0 || isNaN(rate) || rate <= 0) {
      this.setData({ domesticGoldResult: "--" });
      return;
    }
    this.setData({ domesticGoldResult: ((oz / 31.1035) * rate).toFixed(2) });
  },

  _restoreConverterInputs() {
    this.setData({
      intlGoldOzInput: wx.getStorageSync("intlGoldOzInput") || "",
      domesticRateInput: wx.getStorageSync("domesticRateInput") || "",
      isRateManuallyEdited: !!wx.getStorageSync("domesticRateInput"),
    });
  },

  onIntlGoldOzInput(e) {
    const val = e.detail.value;
    this.setData({ intlGoldOzInput: val }, () => {
      this.calculateDomesticGoldPrice();
      wx.setStorageSync("intlGoldOzInput", val);
    });
  },

  onDomesticRateInput(e) {
    const val = e.detail.value;
    this.setData({ domesticRateInput: val, isRateManuallyEdited: !!val }, () => {
      this.calculateDomesticGoldPrice();
      wx.setStorageSync("domesticRateInput", val);
    });
  },

  onUseLiveRate() {
    const liveRate =
      this.data.prices && this.data.prices.exchangeRate
        ? String(this.data.prices.exchangeRate)
        : "";
    if (!liveRate) return;
    this.setData({ domesticRateInput: liveRate, isRateManuallyEdited: false }, () => {
      this.calculateDomesticGoldPrice();
      wx.setStorageSync("domesticRateInput", liveRate);
    });
  },

  onTapConverter() {
    // 点击换算结果区域，复制到剪贴板
    if (this.data.domesticGoldResult === "--") return;
    wx.setClipboardData({
      data: this.data.domesticGoldResult + " 元/克",
    });
  },
});
