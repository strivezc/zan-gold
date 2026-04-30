/**
 * 价格走势图组件 - Canvas 2D 绘制
 * 支持日/周/月切换，触摸十字线查看详情
 */

const { getHistoryData } = require("../../utils/priceHistory");

Component({
  properties: {
    metal: { type: String, value: "gold" },
  },

  data: {
    range: "1d",
    hasData: false,
    touchValue: null,
  },

  lifetimes: {
    ready() {
      this._initCanvas();
    },
  },

  observers: {
    "metal, range"() {
      this._drawChart();
    },
  },

  methods: {
    onRangeChange(e) {
      const range = e.currentTarget.dataset.range;
      this.setData({ range, touchValue: null });
    },

    _initCanvas() {
      const query = this.createSelectorQuery();
      query
        .select("#chartCanvas")
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) return;
          const canvas = res[0].node;
          const ctx = canvas.getContext("2d");
          const dpr = wx.getSystemInfoSync().pixelRatio;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);
          this._canvas = canvas;
          this._ctx = ctx;
          this._width = res[0].width;
          this._height = res[0].height;
          this._drawChart();
        });
    },

    _drawChart() {
      const ctx = this._ctx;
      if (!ctx) return;

      const { metal, range } = this.data;
      const { timestamps, prices } = getHistoryData(metal, range);
      const w = this._width;
      const h = this._height;

      // 清空
      ctx.clearRect(0, 0, w, h);

      if (prices.length < 2) {
        this.setData({ hasData: false });
        this._drawPlaceholder(ctx, w, h);
        return;
      }

      this.setData({ hasData: true });

      const padding = { top: 20, right: 50, bottom: 30, left: 10 };
      const chartW = w - padding.left - padding.right;
      const chartH = h - padding.top - padding.bottom;

      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      const range5 = (maxP - minP) * 0.05 || 1;
      const yMin = minP - range5;
      const yMax = maxP + range5;

      // 坐标映射
      const toX = (i) => padding.left + (i / (prices.length - 1)) * chartW;
      const toY = (p) => padding.top + (1 - (p - yMin) / (yMax - yMin)) * chartH;

      // 网格线
      ctx.strokeStyle = "rgba(0,0,0,0.04)";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([4, 4]);
      for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Y轴标签
      ctx.fillStyle = "#86868b";
      ctx.font = "10px -apple-system";
      ctx.textAlign = "left";
      for (let i = 0; i <= 4; i++) {
        const val = yMax - ((yMax - yMin) / 4) * i;
        const y = padding.top + (chartH / 4) * i;
        ctx.fillText(val.toFixed(1), w - padding.right + 6, y + 3);
      }

      // X轴标签
      ctx.textAlign = "center";
      const labelCount = Math.min(5, timestamps.length);
      for (let i = 0; i < labelCount; i++) {
        const idx = Math.floor((i / (labelCount - 1)) * (timestamps.length - 1));
        const x = toX(idx);
        const d = new Date(timestamps[idx]);
        let label;
        if (range === "1d") {
          label = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
        } else {
          label = `${d.getMonth() + 1}/${d.getDate()}`;
        }
        ctx.fillText(label, x, h - 8);
      }

      // 渐变填充
      const gradient = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
      gradient.addColorStop(0, "rgba(255,149,0,0.25)");
      gradient.addColorStop(1, "rgba(255,149,0,0)");

      ctx.beginPath();
      ctx.moveTo(toX(0), h - padding.bottom);
      for (let i = 0; i < prices.length; i++) {
        ctx.lineTo(toX(i), toY(prices[i]));
      }
      ctx.lineTo(toX(prices.length - 1), h - padding.bottom);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // 价格线
      ctx.beginPath();
      ctx.strokeStyle = "#ff9500";
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      for (let i = 0; i < prices.length; i++) {
        if (i === 0) ctx.moveTo(toX(i), toY(prices[i]));
        else ctx.lineTo(toX(i), toY(prices[i]));
      }
      ctx.stroke();

      // 最新价格点
      const lastX = toX(prices.length - 1);
      const lastY = toY(prices[prices.length - 1]);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ff9500";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();

      // 存储供触摸使用
      this._chartData = { timestamps, prices, toX, toY, padding, chartW, chartH, yMin, yMax, w, h };
    },

    _drawPlaceholder(ctx, w, h) {
      ctx.fillStyle = "#c7c7cc";
      ctx.font = "13px -apple-system";
      ctx.textAlign = "center";
      ctx.fillText("数据积累中，图表将自动显示", w / 2, h / 2);
    },

    onTouchStart(e) {
      this._handleTouch(e);
    },
    onTouchMove(e) {
      this._handleTouch(e);
    },
    onTouchEnd() {
      this.setData({ touchValue: null });
      this._drawChart();
    },

    _handleTouch(e) {
      const cd = this._chartData;
      if (!cd) return;

      const touch = e.touches[0];
      const x = touch.x;
      const idx = Math.round(((x - cd.padding.left) / cd.chartW) * (cd.prices.length - 1));
      const clampedIdx = Math.max(0, Math.min(cd.prices.length - 1, idx));

      const price = cd.prices[clampedIdx];
      const ts = cd.timestamps[clampedIdx];
      const d = new Date(ts);
      const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;

      this.setData({
        touchValue: { price: price.toFixed(2), time: timeStr },
      });

      // 重绘 + 十字线
      this._drawChart();
      const ctx = this._ctx;
      const pointX = cd.toX(clampedIdx);
      const pointY = cd.toY(price);

      // 竖线
      ctx.strokeStyle = "rgba(255,149,0,0.4)";
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pointX, cd.padding.top);
      ctx.lineTo(pointX, cd.h - cd.padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // 交点
      ctx.beginPath();
      ctx.arc(pointX, pointY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ff9500";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pointX, pointY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    },
  },
});
