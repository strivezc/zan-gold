Component({
  data: {
    active: 0,
    tabs: [
      { index: 0, text: "行情", path: "/pages/market/market", icon: "📈" },
      { index: 1, text: "持仓", path: "/pages/portfolio/portfolio", icon: "💰" },
      { index: 2, text: "历史", path: "/pages/history/history", icon: "📋" },
      { index: 3, text: "设置", path: "/pages/settings/settings", icon: "⚙" },
    ],
  },

  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      const tab = this.data.tabs[index];
      if (!tab) return;
      wx.switchTab({ url: tab.path });
    },
  },
});
