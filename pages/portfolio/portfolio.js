import { getPositions, deletePosition, updatePosition } from "../../utils/storage";
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

    // 编辑Sheet
    showEditSheet: false,
    editId: "",
    editMetal: "gold",
    editDate: "",
    editPrice: "",
    editWeight: "",
    editNote: "",

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
      this.getTabBar().setData({ active: 1, isDark: this.data.isDark });
    }
    this._loadData();
  },

  _loadData() {
    const positions = getPositions();
    const prices = app.globalData.prices || {};
    const raw = calcPortfolioSummary(positions, prices);

    // WXML不支持调用JS方法(如toFixed)，需要预格式化
    const fmt2 = (n) => (n || 0).toFixed(2);
    const fmtPnl = (n) => (n >= 0 ? "+" : "") + (n || 0).toFixed(2);
    const summary = {
      gold: { ...raw.gold, _value: fmt2(raw.gold.totalValue), _weight: fmt2(raw.gold.weight), _pnl: fmtPnl(raw.gold.pnl), _pnlRate: fmt2(raw.gold.pnlRate) },
      silver: { ...raw.silver, _value: fmt2(raw.silver.totalValue), _weight: fmt2(raw.silver.weight), _pnl: fmtPnl(raw.silver.pnl), _pnlRate: fmt2(raw.silver.pnlRate) },
      platinum: { ...raw.platinum, _value: fmt2(raw.platinum.totalValue), _weight: fmt2(raw.platinum.weight), _pnl: fmtPnl(raw.platinum.pnl), _pnlRate: fmt2(raw.platinum.pnlRate) },
      palladium: { ...raw.palladium, _value: fmt2(raw.palladium.totalValue), _weight: fmt2(raw.palladium.weight), _pnl: fmtPnl(raw.palladium.pnl), _pnlRate: fmt2(raw.palladium.pnlRate) },
      grandTotal: raw.grandTotal,
      _grandTotal: fmt2(raw.grandTotal),
      totalPnl: raw.totalPnl,
      _totalPnl: fmtPnl(raw.totalPnl),
    };

    const formatted = positions.map((p) => ({
      ...p,
      _weight: p.weight + "",
      _price: p.pricePerGram ? p.pricePerGram.toFixed(2) : "--",
      _date: p.date + (p.note ? " · " + p.note : ""),
    }));

    this.setData({ positions: formatted, summary });
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

  // ========== 编辑持仓 ==========

  onShowEditSheet(e) {
    const id = e.currentTarget.dataset.id;
    const pos = getPositions().find((p) => p.id === id);
    if (!pos) return;
    this.setData({
      showEditSheet: true,
      editId: pos.id,
      editMetal: pos.metal,
      editDate: pos.date,
      editPrice: pos.pricePerGram ? pos.pricePerGram + "" : "",
      editWeight: pos.weight + "",
      editNote: pos.note || "",
    });
  },

  onHideEditSheet() {
    this.setData({ showEditSheet: false });
  },

  onEditMetalChange(e) {
    const metals = ["gold", "silver", "platinum", "palladium"];
    this.setData({ editMetal: metals[e.detail.value] });
  },
  onEditDateChange(e) { this.setData({ editDate: e.detail.value }); },
  onEditPriceInput(e) { this.setData({ editPrice: e.detail.value }); },
  onEditWeightInput(e) { this.setData({ editWeight: e.detail.value }); },
  onEditNoteInput(e) { this.setData({ editNote: e.detail.value }); },

  onConfirmEdit() {
    const { editId, editMetal, editDate, editPrice, editWeight, editNote } = this.data;
    const weight = parseFloat(editWeight);
    if (!weight || weight <= 0) {
      wx.showToast({ title: "请输入克数", icon: "none" });
      return;
    }
    updatePosition(editId, {
      metal: editMetal,
      date: editDate,
      pricePerGram: editPrice ? parseFloat(editPrice) : 0,
      weight,
      note: editNote || "",
    });
    this.setData({ showEditSheet: false });
    this._loadData();
    wx.showToast({ title: "已更新", icon: "success" });
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
      sellAvailableStr: metalData ? metalData.weight.toFixed(2) : "0.00",
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
