/**
 * 持仓截图分享服务 - 离屏Canvas生成精美持仓卡片
 */

const { formatCny, formatPercent } = require("./formatter");

const METAL_NAMES = { gold: "黄金", silver: "白银", platinum: "铂金", palladium: "钯金" };
const METAL_ICONS = { gold: "Au", silver: "Ag", platinum: "Pt", palladium: "Pd" };

/**
 * 生成持仓卡片图片
 * @param {object} summary - calcPortfolioSummary 的结果
 * @param {object} prices - 当前价格数据
 * @returns {Promise<string>} 临时文件路径
 */
function generatePortfolioCard(summary, prices) {
  return new Promise((resolve, reject) => {
    const canvas = wx.createOffscreenCanvas({ type: "2d", width: 750, height: 1000 });
    const ctx = canvas.getContext("2d");
    const w = 750;
    const h = 1000;

    // 背景渐变
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "#1d1d1f");
    bgGrad.addColorStop(1, "#2c2c2e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 品牌Logo
    ctx.fillStyle = "#ff9500";
    roundRect(ctx, 60, 60, 40, 40, 8);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px -apple-system, sans-serif";
    ctx.fillText("ZAN GOLD", 120, 92);

    // 总净值
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "24px -apple-system, sans-serif";
    ctx.fillText("资产总净值 (CNY)", 60, 180);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 72px -apple-system, sans-serif";
    ctx.fillText("¥" + formatCny(summary.grandTotal), 60, 260);

    // 盈亏
    const pnlColor = summary.totalPnl >= 0 ? "#ff453a" : "#30d158";
    ctx.fillStyle = pnlColor;
    ctx.font = "bold 28px -apple-system, sans-serif";
    const pnlSign = summary.totalPnl >= 0 ? "+" : "";
    ctx.fillText(`累计盈亏: ${pnlSign}${formatCny(summary.totalPnl)} 元`, 60, 310);

    // 金属卡片
    const metals = ["gold", "silver", "platinum", "palladium"];
    let cardY = 370;
    const cardW = 300;
    const cardH = 180;
    const cardGap = 30;

    metals.forEach((metal, i) => {
      const data = summary[metal];
      if (!data || data.weight <= 0) return;

      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 60 + col * (cardW + cardGap);
      const y = cardY + row * (cardH + cardGap);

      // 卡片背景
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      roundRect(ctx, x, y, cardW, cardH, 20);
      ctx.fill();

      // 金属名
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "bold 22px -apple-system, sans-serif";
      ctx.fillText(`${METAL_ICONS[metal]} ${METAL_NAMES[metal]}`, x + 24, y + 40);

      // 市值
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 32px -apple-system, sans-serif";
      ctx.fillText("¥" + formatCny(data.totalValue), x + 24, y + 85);

      // 克数
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "20px -apple-system, sans-serif";
      ctx.fillText(`${data.weight.toFixed(2)}g`, x + 24, y + 120);

      // 盈亏
      const mPnlColor = data.pnl >= 0 ? "#ff453a" : "#30d158";
      ctx.fillStyle = mPnlColor;
      ctx.font = "bold 22px -apple-system, sans-serif";
      ctx.fillText(formatPercent(data.pnlRate), x + 24, y + 155);
    });

    // 底部信息
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "20px -apple-system, sans-serif";
    ctx.fillText(`${timeStr}  汇率 ${prices.exchangeRate || "--"}`, 60, h - 60);

    // 导出
    wx.canvasToTempFilePath({
      canvas,
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => reject(err),
    });
  });
}

/**
 * 保存图片到相册
 * @param {string} filePath
 */
function saveToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve(true),
      fail: (err) => {
        if (err.errMsg.includes("deny") || err.errMsg.includes("auth")) {
          wx.showModal({
            title: "需要相册权限",
            content: "请在设置中允许保存到相册",
            success: (res) => {
              if (res.confirm) wx.openSetting();
            },
          });
        }
        reject(err);
      },
    });
  });
}

/**
 * 绘制圆角矩形辅助函数
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

module.exports = { generatePortfolioCard, saveToAlbum };
