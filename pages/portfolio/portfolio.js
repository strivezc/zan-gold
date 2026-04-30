import { getPositions, deletePosition } from "../../utils/storage";
import { calcPortfolioSummary } from "../../utils/calculator";
import { genId, todayStr } from "../../utils/formatter";
import { addBuyTransaction, addSellTransaction } from "../../utils/transactionService";
import { generatePortfolioCard, saveToAlbum } from "../../utils/screenshotService";

const app = getApp();

const METAL_NAMES = {
  gold: "黄金",
  silver: "白银",
  platinum: "铂金",
  palladium: "钯金",
};

const METAL_ICONS = {
  gold: "Au",
  silver: "Ag",
  platinum: "Pt",
  palladium: "Pd",
};

Page({
  data: {
    positions: [],
    summary: null,

    // 添加持仓Sheet
    showAddSheet: false,
    newMetal: "gold",
    newDate: "",
    newPrice: "",
    newWeight: "",
    newNote: "",

    // 卖出Sheet
    showSellSheet: false,
    sellMetal: "",
    sellWeight: "",
    sellPrice: "",
    sellAvailable: 0,

    metalNames: METAL_NAMES,
    metalIcons: METAL_ICONS,
    isDark: false,
  },

  onShow() {
    this.setData({ isDark: app.globalData.isDark || false });
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ active: 1 });
    }
    this._loadData();
  },

  _loadData() {
    const positions = getPositions();
    const prices = app.globalData.prices || {};
    const summary = calcPortfolioSummary(positions, prices);
    this.setData({ positions, summary });
  },

  _getDefaultPrice(metal) {
    const prices = app.globalData.prices || {};
    return prices[metal] ? prices[metal].price_g : "";
  },

  // ========== 买入(添加持仓) ==========

  onShowAddSheet() {
    this.setData({
      showAddSheet: true,
      newDate: todayStr(),
      newPrice: this._getDefaultPrice(this.data.newMetal) || "",
      newWeight: "",
      newNote: "",
    });
  },

  onHideAddSheet() {
    this.setData({ showAddSheet: false });
  },

  onMetalChange(e) {
    const metals = ["gold", "silver", "platinum", "palladium"];
    const metal = metals[e.detail.value];
    this.setData({
      newMetal: metal,
      newPrice: this._getDefaultPrice(metal) || this.data.newPrice,
    });
  },

  onDateChange(e) { this.setData({ newDate: e.detail.value }); },
  onNewPriceInput(e) { this.setData({ newPrice: e.detail.value }); },
  onNewWeightInput(e) { this.setData({ newWeight: e.detail.value }); },
  onNewNoteInput(e) { this.setData({ newNote: e.detail.value }); },

  onConfirmAdd() {
    const { newMetal, newDate, newPrice, newWeight, newNote } = this.data;

    if (!newWeight || parseFloat(newWeight) <= 0) {
      wx.showToast({ title: "请输入克数", icon: "none" });
      return;
    }

    addBuyTransaction({
      metal: newMetal,
      pricePerGram: newPrice ? parseFloat(newPrice) : 0,
      weight: parseFloat(newWeight),
      date: newDate || todayStr(),
      note: newNote || "",
    });

    this.setData({ showAddSheet: false });
    this._loadData();
    wx.showToast({ title: "买入成功", icon: "success" });
  },

  // ========== 卖出 ==========

  onShowSellSheet(e) {
    const metal = e.currentTarget.dataset.metal;
    const prices = app.globalData.prices || {};
    const summary = this.data.summary;
    const metalData = summary ? summary[metal] : null;

    this.setData({
      showSellSheet: true,
      sellMetal: metal,
      sellWeight: "",
      sellPrice: prices[metal] ? prices[metal].price_g : "",
      sellAvailable: metalData ? metalData.weight : 0,
    });
  },

  onHideSellSheet() {
    this.setData({ showSellSheet: false });
  },

  onSellWeightInput(e) { this.setData({ sellWeight: e.detail.value }); },
  onSellPriceInput(e) { this.setData({ sellPrice: e.detail.value }); },

  onConfirmSell() {
    const { sellMetal, sellWeight, sellPrice } = this.data;
    const weight = parseFloat(sellWeight);
    const price = parseFloat(sellPrice);

    if (!weight || weight <= 0) {
      wx.showToast({ title: "请输入卖出克数", icon: "none" });
      return;
    }
    if (!price || price <= 0) {
      wx.showToast({ title: "请输入卖出价格", icon: "none" });
      return;
    }

    const result = addSellTransaction({
      metal: sellMetal,
      weight,
      sellPrice: price,
      date: todayStr(),
    });

    if (result.error) {
      wx.showToast({ title: result.error, icon: "none" });
      return;
    }

    this.setData({ showSellSheet: false });
    this._loadData();

    const pnlText = result.realizedPnl >= 0
      ? `盈利 +${result.realizedPnl.toFixed(2)}`
      : `亏损 ${result.realizedPnl.toFixed(2)}`;
    wx.showToast({ title: `卖出成功，${pnlText}`, icon: "none", duration: 2000 });
  },

  // ========== 删除(清空) ==========

  onDeletePosition(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "删除持仓",
      content: "删除此持仓记录(不影响交易历史)？",
      confirmColor: "#ff3b30",
      success: (res) => {
        if (res.confirm) {
          deletePosition(id);
          this._loadData();
        }
      },
    });
  },

  // ========== 截图分享 ==========

  async onSharePortfolio() {
    if (this.data.positions.length === 0) {
      wx.showToast({ title: "暂无持仓数据", icon: "none" });
      return;
    }

    wx.showLoading({ title: "生成中..." });

    try {
      const prices = app.globalData.prices || {};
      const filePath = await generatePortfolioCard(this.data.summary, prices);
      wx.hideLoading();

      wx.previewImage({ urls: [filePath], current: filePath });

      wx.showActionSheet({
        itemList: ["保存到相册"],
        success: async (res) => {
          if (res.tapIndex === 0) {
            try {
              await saveToAlbum(filePath);
              wx.showToast({ title: "已保存到相册", icon: "success" });
            } catch (e) {
              console.error("保存失败:", e);
            }
          }
        },
      });
    } catch (err) {
      wx.hideLoading();
      console.error("生成截图失败:", err);
      wx.showToast({ title: "生成失败", icon: "none" });
    }
  },

  onShareAppMessage() {
    return {
      title: "我的贵金属持仓 - ZAN GOLD",
      path: "/pages/market/market",
    };
  },
});
