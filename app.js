const { migrateOldData, getSettings, setCloudService } = require("./utils/storage");
const storage = require("./utils/storage");
const cloudService = require("./utils/cloudService");

App({
  onLaunch() {
    console.log("金攒攒 小程序启动");

    // 数据迁移(旧格式 → 新多笔持仓格式)
    migrateOldData();

    // 初始化主题
    const settings = getSettings();
    this.applyTheme(settings.themeMode || "light");

    // 接入云同步
    setCloudService(cloudService);
    this._initCloud();
  },

  /**
   * 初始化云开发并同步数据
   */
  async _initCloud() {
    if (!wx.cloud) return;

    try {
      wx.cloud.init({ env: "cloud1-d7gj7xio9ed11b22a", traceUser: true });
      this.globalData.cloudReady = true;

      // 拉取云端数据并合并(带超时保护)
      const cloudData = await Promise.race([
        cloudService.syncFromCloud(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("cloud timeout")), 8000)),
      ]);
      if (cloudData) {
        const localData = {
          positions: storage.getPositions(),
          transactions: storage.getTransactions(),
          alerts: storage.getAlerts(),
          settings: storage.getSettings(),
          updatedAt: wx.getStorageSync("localUpdatedAt") || 0,
        };
        const merged = cloudService.mergeData(localData, cloudData);

        // 写回本地
        storage.savePositions(merged.positions || []);
        storage.saveTransactions(merged.transactions || []);
        storage.saveAlerts(merged.alerts || []);
        storage.saveSettings(merged.settings || {});
      } else {
        // 首次使用，推送本地数据到云端
        cloudService.syncToCloud({
          positions: storage.getPositions(),
          transactions: storage.getTransactions(),
          alerts: storage.getAlerts(),
          settings: storage.getSettings(),
        });
      }

      // 注册数据变更回调
      cloudService.onDataChanged = () => {
        const now = Date.now();
        wx.setStorageSync("localUpdatedAt", now);
        cloudService.syncToCloud({
          positions: storage.getPositions(),
          transactions: storage.getTransactions(),
          alerts: storage.getAlerts(),
          settings: storage.getSettings(),
          updatedAt: now,
        });
      };
    } catch (err) {
      console.warn("云同步跳过:", err.message || err);
      this.globalData.cloudReady = false;
    }
  },

  onHide() {
    // 页面隐藏时立即同步(不走防抖)
    if (this.globalData.cloudReady) {
      const now = Date.now();
      wx.setStorageSync("localUpdatedAt", now);
      cloudService.syncToCloud({
        positions: storage.getPositions(),
        transactions: storage.getTransactions(),
        alerts: storage.getAlerts(),
        settings: storage.getSettings(),
        updatedAt: now,
      }, true);
    }
  },

  /**
   * 应用主题
   * @param {string} mode - "system" | "light" | "dark"
   */
  applyTheme(mode) {
    const isDark = mode === "dark";
    this.globalData.isDark = isDark;
    this._notifyThemeChange(isDark);
  },

  _notifyThemeChange(isDark) {
    const pages = getCurrentPages();
    pages.forEach((p) => {
      if (p.setData) p.setData({ isDark });
      if (typeof p.getTabBar === "function" && p.getTabBar()) {
        p.getTabBar().setData({ isDark });
      }
    });
  },

  globalData: {
    prices: null,
    isDark: false,
    cloudReady: false,
  },
});
