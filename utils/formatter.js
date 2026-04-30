/**
 * 显示格式化与动画模块
 */

/**
 * 格式化人民币金额
 * @param {number} amount
 * @returns {string} 如 "48,000.00"
 */
function formatCny(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return "0.00";
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * 格式化克数
 * @param {number} grams
 * @returns {string} 如 "100.00g"
 */
function formatWeight(grams) {
  if (!grams || isNaN(grams)) return "0.00g";
  return grams.toFixed(2) + "g";
}

/**
 * 格式化百分比
 * @param {number} decimal - 如 12.5
 * @returns {string} 如 "+12.50%"
 */
function formatPercent(decimal) {
  if (decimal === null || decimal === undefined || isNaN(decimal)) return "0.00%";
  const sign = decimal >= 0 ? "+" : "";
  return sign + decimal.toFixed(2) + "%";
}

/**
 * 格式化盈亏金额(带符号)
 * @param {number} amount
 * @returns {string} 如 "+3,200.00"
 */
function formatPnl(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return "0.00";
  const sign = amount >= 0 ? "+" : "";
  return sign + formatCny(amount);
}

/**
 * 数字跳动动画
 * @param {object} page - Page实例(this)
 * @param {string} field - data字段名
 * @param {number} start - 起始值
 * @param {number} end - 终止值
 * @param {number} duration - 动画时长ms (默认600)
 */
function animateNumber(page, field, start, end, duration) {
  duration = duration || 600;
  if (Math.abs(start - end) < 0.01) {
    page.setData({ [field]: end.toFixed(2) });
    return;
  }
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
    page.setData({ [field]: current.toFixed(2) });
  }, duration / steps);
}

/**
 * 生成唯一ID
 * @returns {string}
 */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * 获取今日日期字符串
 * @returns {string} YYYY-MM-DD
 */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = {
  formatCny,
  formatWeight,
  formatPercent,
  formatPnl,
  animateNumber,
  genId,
  todayStr,
};
