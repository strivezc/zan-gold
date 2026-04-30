import { fetchLivePrices } from "../../utils/goldService";

Page({
  data: {
    prices: null,
    loading: false,
    lastUpdate: "",
    refreshInterval: null,

    displayGoldPrice: "0.00",
    displaySilverPrice: "0.00",
    displayGrandTotal: "0.00",
    displayGoldTotal: "0.00",
    displaySilverTotal: "0.00",

    currentGoldPrice: 0,
    currentSilverPrice: 0,
    currentGrandTotal: 0,

    goldWeight: "",
    silverWeight: "",
    goldCost: "",
    silverCost: "",
    intlGoldOzInput: "",
    domesticRateInput: "",
    domesticGoldResult: "--",
    isRateManuallyEdited: false,

    goldPnl: "0.00", // 改为字符串存储，避免 JS 浮点精度问题
    goldPnlRate: "0.00",
    silverPnl: "0.00",
    silverPnlRate: "0.00",
    totalPnl: "0.00", // 改为字符串
  },

  onLoad() {
    const goldWeight = wx.getStorageSync("goldWeight") || "";
    const silverWeight = wx.getStorageSync("silverWeight") || "";
    const goldCost = wx.getStorageSync("goldCost") || "";
    const silverCost = wx.getStorageSync("silverCost") || "";
    const intlGoldOzInput = wx.getStorageSync("intlGoldOzInput") || "";
    const domesticRateInput = wx.getStorageSync("domesticRateInput") || "";

    this.setData({
      goldWeight,
      silverWeight,
      goldCost,
      silverCost,
      intlGoldOzInput,
      domesticRateInput,
      isRateManuallyEdited: !!domesticRateInput,
    });
    this.calculateDomesticGoldPrice();

    this.refreshPrices();
    this.startAutoRefresh();
  },

  onUnload() {
    this.stopAutoRefresh();
  },
  onHide() {
    this.stopAutoRefresh();
  },
  onShow() {
    if (!this.data.refreshInterval) {
      this.refreshPrices();
      this.startAutoRefresh();
    }
  },

  async refreshPrices() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const data = await fetchLivePrices();

      const updatedData = {
        prices: data,
        lastUpdate: data.lastUpdate || "",
      };

      if (!this.data.intlGoldOzInput && data.gold && data.gold.price_oz) {
        updatedData.intlGoldOzInput = String(data.gold.price_oz);
      }

      if (!this.data.isRateManuallyEdited && data.exchangeRate) {
        updatedData.domesticRateInput = String(data.exchangeRate);
      }

      this.setData(updatedData, () => {
        this.calculateDomesticGoldPrice();
      });

      if (data.gold) {
        const newGoldPrice = parseFloat(data.gold.price_g);
        this.animateNumber(
          "displayGoldPrice",
          this.data.currentGoldPrice,
          newGoldPrice,
        );
        this.setData({ currentGoldPrice: newGoldPrice });
      }
      if (data.silver) {
        const newSilverPrice = parseFloat(data.silver.price_g);
        this.animateNumber(
          "displaySilverPrice",
          this.data.currentSilverPrice,
          newSilverPrice,
        );
        this.setData({ currentSilverPrice: newSilverPrice });
      }

      this.calculateAssets();
    } catch (err) {
      console.error("刷新异常:", err);
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  calculateAssets() {
    const {
      goldWeight,
      silverWeight,
      goldCost,
      silverCost,
      currentGoldPrice,
      currentSilverPrice,
    } = this.data;

    let goldTotal = 0;
    let silverTotal = 0;

    let goldPnl = 0,
      goldPnlRate = 0;
    let silverPnl = 0,
      silverPnlRate = 0;

    // 1. 黄金计算
    if (currentGoldPrice && goldWeight) {
      const weight = parseFloat(goldWeight);
      if (!isNaN(weight)) {
        goldTotal = currentGoldPrice * weight;

        if (goldCost) {
          const costPrice = parseFloat(goldCost);
          if (!isNaN(costPrice)) {
            const costTotal = costPrice * weight;
            goldPnl = goldTotal - costTotal;
            goldPnlRate = costTotal > 0 ? (goldPnl / costTotal) * 100 : 0;
          }
        }
      }
    }

    // 2. 白银计算
    if (currentSilverPrice && silverWeight) {
      const weight = parseFloat(silverWeight);
      if (!isNaN(weight)) {
        silverTotal = currentSilverPrice * weight;

        if (silverCost) {
          const costPrice = parseFloat(silverCost);
          if (!isNaN(costPrice)) {
            const costTotal = costPrice * weight;
            silverPnl = silverTotal - costTotal;
            silverPnlRate = costTotal > 0 ? (silverPnl / costTotal) * 100 : 0;
          }
        }
      }
    }

    const newGrandTotal = goldTotal + silverTotal;
    const totalPnl = goldPnl + silverPnl;

    this.animateNumber(
      "displayGrandTotal",
      this.data.currentGrandTotal,
      newGrandTotal,
    );

    this.setData({
      displayGoldTotal: goldTotal.toFixed(2),
      displaySilverTotal: silverTotal.toFixed(2),
      currentGrandTotal: newGrandTotal,

      // 修复：强制 toFixed(2) 解决浮点精度问题
      goldPnl: goldPnl.toFixed(2),
      goldPnlRate: goldPnlRate.toFixed(2),
      silverPnl: silverPnl.toFixed(2),
      silverPnlRate: silverPnlRate.toFixed(2),
      totalPnl: totalPnl.toFixed(2),
    });
  },

  calculateDomesticGoldPrice() {
    const intlGoldOz = parseFloat(this.data.intlGoldOzInput);
    const exchangeRate = parseFloat(this.data.domesticRateInput);

    if (
      isNaN(intlGoldOz) ||
      intlGoldOz <= 0 ||
      isNaN(exchangeRate) ||
      exchangeRate <= 0
    ) {
      this.setData({ domesticGoldResult: "--" });
      return;
    }

    const domesticGold = (intlGoldOz / 31.1035) * exchangeRate;
    this.setData({ domesticGoldResult: domesticGold.toFixed(2) });
  },

  animateNumber(field, start, end) {
    if (Math.abs(start - end) < 0.01) {
      this.setData({ [field]: end.toFixed(2) });
      return;
    }
    const duration = 600;
    const steps = 20;
    const stepValue = (end - start) / steps;
    let current = start;
    let count = 0;

    const timer = setInterval(() => {
      current += stepValue;
      count++;
      if (count >= steps) {
        clearInterval(timer);
        current = end;
      }
      this.setData({ [field]: current.toFixed(2) });
    }, duration / steps);
  },

  onGoldWeightInput(e) {
    const val = e.detail.value;
    this.setData({ goldWeight: val }, () => {
      this.calculateAssets();
      wx.setStorageSync("goldWeight", val);
    });
  },

  onGoldCostInput(e) {
    const val = e.detail.value;
    this.setData({ goldCost: val }, () => {
      this.calculateAssets();
      wx.setStorageSync("goldCost", val);
    });
  },

  onSilverWeightInput(e) {
    const val = e.detail.value;
    this.setData({ silverWeight: val }, () => {
      this.calculateAssets();
      wx.setStorageSync("silverWeight", val);
    });
  },

  onSilverCostInput(e) {
    const val = e.detail.value;
    this.setData({ silverCost: val }, () => {
      this.calculateAssets();
      wx.setStorageSync("silverCost", val);
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
    this.setData(
      { domesticRateInput: val, isRateManuallyEdited: !!val },
      () => {
        this.calculateDomesticGoldPrice();
        wx.setStorageSync("domesticRateInput", val);
      },
    );
  },

  onUseLiveRate() {
    const liveRate =
      this.data.prices && this.data.prices.exchangeRate
        ? String(this.data.prices.exchangeRate)
        : "";

    if (!liveRate) return;

    this.setData(
      {
        domesticRateInput: liveRate,
        isRateManuallyEdited: false,
      },
      () => {
        this.calculateDomesticGoldPrice();
        wx.setStorageSync("domesticRateInput", liveRate);
      },
    );
  },

  startAutoRefresh() {
    this.stopAutoRefresh();
    const interval = setInterval(() => {
      this.refreshPrices();
    }, 30000);
    this.setData({ refreshInterval: interval });
  },

  stopAutoRefresh() {
    if (this.data.refreshInterval) {
      clearInterval(this.data.refreshInterval);
      this.setData({ refreshInterval: null });
    }
  },

  onPullDownRefresh() {
    this.refreshPrices();
  },
});
