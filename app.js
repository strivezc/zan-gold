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
    this.applyTheme(settings.themeMode || "system");

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
      wx.cloud.init({ env: "zan-gold-prod", traceUser: true });
      this.globalData.cloudReady = true;

      // 拉取云端数据并合并
      const cloudData = await cloudService.syncFromCloud();
      if (cloudData) {
        const localData = {
          positions: storage.getPositions(),
          transactions: storage.getTransactions(),
          alerts: storage.getAlerts(),
          settings: storage.getSettings(),
          updatedAt: 0,
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
        cloudService.syncToCloud({
          positions: storage.getPositions(),
          transactions: storage.getTransactions(),
          alerts: storage.getAlerts(),
          settings: storage.getSettings(),
        });
      };
    } catch (err) {
      console.error("云初始化失败:", err);
    }
  },

  onHide() {
    // 页面隐藏时立即同步
    if (this.globalData.cloudReady) {
      cloudService.syncToCloud({
        positions: storage.getPositions(),
        transactions: storage.getTransactions(),
        alerts: storage.getAlerts(),
        settings: storage.getSettings(),
      });
    }
  },

  /**
   * 应用主题
   * @param {string} mode - "system" | "light" | "dark"
   */
  applyTheme(mode) {
    let isDark = false;
    if (mode === "dark") {
      isDark = true;
    } else if (mode === "system") {
      try {
        const info = wx.getSystemInfoSync();
        isDark = info.theme === "dark";
      } catch (e) {
        isDark = false;
      }
    }
    this.globalData.isDark = isDark;

    // 监听系统主题变化
    if (mode === "system" && wx.onThemeChange) {
      wx.onThemeChange((res) => {
        this.globalData.isDark = res.theme === "dark";
      });
    }
  },

  globalData: {
    prices: null,
    isDark: false,
    cloudReady: false,
  },
});
