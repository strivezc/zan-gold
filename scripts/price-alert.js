/**
 * Gold price range alert (Node.js)
 *
 * Logic aligned with mini-program:
 * domesticCnyPerGram = (internationalUsdPerOz / 31.1035) * usdCnyRate
 */

const cron = require("node-cron");
const nodemailer = require("nodemailer");
require("dotenv").config();

const GOLD_API_URL = "https://api.gold-api.com/price/XAU";
const FX_API_URL = "https://open.er-api.com/v6/latest/USD";
const OUNCE_TO_GRAM = 31.1035;

const TARGET_MIN = Number(process.env.TARGET_MIN_CNY_G);
const TARGET_MAX = Number(process.env.TARGET_MAX_CNY_G);
const CRON_EXPR = process.env.CRON_EXPR || "*/5 * * * *"; // every 5 minutes
const TZ = process.env.TZ || "Asia/Shanghai";
const COOLDOWN_MINUTES = Number(process.env.COOLDOWN_MINUTES || 60);

const MAIL_FROM = process.env.QQ_EMAIL;
const MAIL_PASS = process.env.QQ_AUTH_CODE;
const MAIL_TO = process.env.ALERT_TO;

let lastAlertSentAt = 0;
let wasInRange = false;

function validateConfig() {
  const required = [
    ["QQ_EMAIL", MAIL_FROM],
    ["QQ_AUTH_CODE", MAIL_PASS],
    ["ALERT_TO", MAIL_TO],
    ["TARGET_MIN_CNY_G", process.env.TARGET_MIN_CNY_G],
    ["TARGET_MAX_CNY_G", process.env.TARGET_MAX_CNY_G],
  ];

  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    throw new Error(`Missing env config: ${missing.join(", ")}`);
  }

  if (Number.isNaN(TARGET_MIN) || Number.isNaN(TARGET_MAX)) {
    throw new Error("TARGET_MIN_CNY_G / TARGET_MAX_CNY_G must be numbers");
  }

  if (TARGET_MIN > TARGET_MAX) {
    throw new Error("TARGET_MIN_CNY_G cannot be greater than TARGET_MAX_CNY_G");
  }
}

const transporter = nodemailer.createTransport({
  service: "qq",
  port: 465,
  secure: true,
  auth: {
    user: MAIL_FROM,
    pass: MAIL_PASS,
  },
});

async function fetchGoldUsdPerOz() {
  const res = await fetch(GOLD_API_URL);
  if (!res.ok) throw new Error(`Gold API failed: ${res.status}`);

  const data = await res.json();
  const usdPerOz = Number(data.price);
  if (!usdPerOz) throw new Error("Gold API returned invalid price");
  return usdPerOz;
}

async function fetchUsdCnyRate() {
  const res = await fetch(FX_API_URL);
  if (!res.ok) throw new Error(`FX API failed: ${res.status}`);

  const data = await res.json();
  const rate = Number(data?.rates?.CNY);
  if (!rate) throw new Error("FX API returned invalid USD/CNY rate");
  return rate;
}

function calcDomesticGold(usdPerOz, usdCnyRate) {
  return (usdPerOz / OUNCE_TO_GRAM) * usdCnyRate;
}

function shouldSendEmail(isInRange) {
  const now = Date.now();
  const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;
  const inCooldown = now - lastAlertSentAt < cooldownMs;

  if (!isInRange) return false;
  if (!wasInRange) return true; // edge trigger: just entered range
  if (!inCooldown) return true; // still in range, but cooldown passed
  return false;
}

async function sendAlertMail(payload) {
  const { domesticCnyPerGram, usdPerOz, usdCnyRate, nowText } = payload;
  const subject = `金价提醒：已进入目标区间 ${TARGET_MIN}-${TARGET_MAX} 元/克`;
  const text = [
    `时间：${nowText}`,
    `国际金价：${usdPerOz.toFixed(2)} USD/oz`,
    `美元汇率：${usdCnyRate.toFixed(4)}`,
    `国内参考金价：${domesticCnyPerGram.toFixed(2)} 元/克`,
    `目标区间：${TARGET_MIN} - ${TARGET_MAX} 元/克`,
  ].join("\n");

  await transporter.sendMail({
    from: `金价提醒 <${MAIL_FROM}>`,
    to: MAIL_TO,
    subject,
    text,
  });
}

async function checkOnce() {
  const now = new Date();
  const nowText = now.toLocaleString("zh-CN", { hour12: false, timeZone: TZ });

  try {
    const [usdPerOz, usdCnyRate] = await Promise.all([
      fetchGoldUsdPerOz(),
      fetchUsdCnyRate(),
    ]);
    const domesticCnyPerGram = calcDomesticGold(usdPerOz, usdCnyRate);
    const isInRange =
      domesticCnyPerGram >= TARGET_MIN && domesticCnyPerGram <= TARGET_MAX;

    const logLine = `[${nowText}] USD/oz=${usdPerOz.toFixed(2)} rate=${usdCnyRate.toFixed(
      4,
    )} CNY/g=${domesticCnyPerGram.toFixed(2)} inRange=${isInRange}`;
    console.log(logLine);

    if (shouldSendEmail(isInRange)) {
      await sendAlertMail({ domesticCnyPerGram, usdPerOz, usdCnyRate, nowText });
      lastAlertSentAt = Date.now();
      console.log(`[${nowText}] Alert email sent to ${MAIL_TO}`);
    }

    wasInRange = isInRange;
  } catch (err) {
    console.error(`[${nowText}] check failed:`, err.message || err);
  }
}

function start() {
  validateConfig();
  console.log("Gold alert service started.");
  console.log(`Cron: ${CRON_EXPR}`);
  console.log(`Target range: ${TARGET_MIN} - ${TARGET_MAX} 元/克`);

  checkOnce(); // run immediately
  cron.schedule(CRON_EXPR, checkOnce, { timezone: TZ });
}

start();

