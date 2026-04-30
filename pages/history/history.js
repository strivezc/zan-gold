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

    this.setData({
      transactions: allTxs,
      totalRealizedPnl: pnlSummary.grand,
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
    this.setData({ filteredTransactions: filtered });
  },

  onFilterChange(e) {
    this.setData({ filter: e.currentTarget.dataset.filter }, () => {
      this._applyFilter();
    });
  },
});
