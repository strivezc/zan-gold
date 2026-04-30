import { getTransactions } from "../../utils/storage";
import { getRealizedPnlSummary } from "../../utils/transactionService";

const app = getApp();

const METAL_NAMES = {
  gold: "黄金",
  silver: "白银",
  platinum: "铂金",
  palladium: "钯金",
};

Page({
  data: {
    transactions: [],
    filteredTransactions: [],
    filter: "all",
    totalRealizedPnl: 0,
    pnlSummary: {},
    isDark: false,
  },

  onShow() {
    this.setData({ isDark: app.globalData.isDark || false });
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ active: 2 });
    }
    this._loadData();
  },

  _loadData() {
    const allTxs = getTransactions();
    allTxs.sort((a, b) => b.createdAt - a.createdAt);

    const pnlSummary = getRealizedPnlSummary();
    const fmt2 = (n) => (n || 0).toFixed(2);

    this.setData({
      transactions: allTxs,
      totalRealizedPnl: pnlSummary.grand,
      _totalPnlStr: fmt2(pnlSummary.grand),
      _pnlSign: pnlSummary.grand >= 0 ? "+" : "",
      pnlSummary,
    });
    this._applyFilter();
  },

  _applyFilter() {
    const { transactions, filter } = this.data;
    const filtered =
      filter === "all"
        ? transactions
        : transactions.filter((t) => t.type === filter);

    const formatted = filtered.map((t) => ({
      ...t,
      _weight: t.weight + "",
      _price: t.pricePerGram ? t.pricePerGram.toFixed(2) : "--",
      _pnl: t.realizedPnl !== null ? (t.realizedPnl >= 0 ? "+" : "") + t.realizedPnl.toFixed(2) : "",
      _date: t.date + (t.note ? " · " + t.note : ""),
      _metal: METAL_NAMES[t.metal] || t.metal,
    }));

    this.setData({ filteredTransactions: formatted });
  },

  onFilterChange(e) {
    this.setData({ filter: e.currentTarget.dataset.filter }, () => {
      this._applyFilter();
    });
  },
});
