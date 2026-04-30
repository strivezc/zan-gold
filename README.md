# ZAN GOLD - 金攒攒

一款微信小程序，用于贵金属投资管理。实时追踪黄金、白银、铂金、钯金价格，支持多笔持仓管理、交易记录、价格预警和云端同步。

## 功能特性

- **实时行情** — 黄金(XAU)、白银(XAG)、铂金(XPT)、钯金(XPD) 国内价格，每30秒自动刷新
- **金银比** — 实时金银比指标
- **多笔持仓** — 支持多笔买入记录，自动计算加权成本和未实现盈亏
- **买入/卖出** — FIFO 成本匹配，精确计算已实现盈亏
- **交易历史** — 完整交易记录，支持筛选和盈亏汇总
- **价格预警** — 设置目标价格，达到时推送微信通知
- **价格走势图** — Canvas 2D 图表，支持日/周/月切换，触摸十字线
- **持仓截图** — 一键生成分享卡片，保存相册或发送好友
- **暗黑模式** — 浅色/深色主题切换
- **微信云同步** — 多设备数据自动同步，冲突自动合并

## 技术栈

- 微信小程序原生框架
- 微信云开发（云函数 + 云数据库）
- Canvas 2D（价格走势图 + 截图分享）
- CSS Custom Properties（主题系统）

## 项目结构

```
├── app.js                     # 入口：数据迁移、主题初始化、云同步
├── app.json                   # 页面路由、tabBar 配置
├── app.wxss                   # 全局 CSS 变量 + 暗黑模式
├── custom-tab-bar/            # 自定义 tabBar 组件
├── pages/
│   ├── market/                # 行情页：价格展示、金银比、走势图、换算器
│   ├── portfolio/             # 持仓页：多笔持仓管理、买入/卖出、截图分享
│   ├── history/               # 历史页：交易记录、已实现盈亏、筛选
│   └── settings/              # 设置页：主题切换、价格预警、数据管理
├── components/
│   └── price-chart/           # Canvas 2D 价格走势图组件
├── utils/
│   ├── goldService.js         # API 层：获取四种金属价格 + 汇率
│   ├── storage.js             # 数据持久化 + 云同步钩子
│   ├── calculator.js          # 纯计算函数：加权成本、盈亏
│   ├── transactionService.js  # 买入/卖出逻辑 + FIFO 匹配
│   ├── priceHistory.js        # 价格快照记录 + 三级聚合
│   ├── alertService.js        # 预警检测 + 通知推送
│   ├── cloudService.js        # 云端同步 + 冲突合并
│   ├── screenshotService.js   # 离屏 Canvas 截图生成
│   └── formatter.js           # 显示格式化 + 数字动画
├── cloudfunctions/
│   ├── getOpenId/             # 获取用户 openId
│   └── sendAlert/             # 发送订阅消息推送
└── scripts/
    └── price-alert.js         # 独立邮件价格提醒脚本（Node.js）
```

## 开发环境

### 微信小程序

1. 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入项目目录，填写你的 AppID
3. 在开发者工具中开通云开发，创建云环境
4. 上传并部署 `cloudfunctions/` 下的两个云函数
5. 修改 `app.js` 中的云环境 ID 为你自己的环境

### 邮件价格提醒（可选）

独立的 Node.js 脚本，通过 QQ 邮箱定时发送金价提醒邮件：

```bash
npm install
cp .env.example .env   # 配置 QQ 邮箱和目标价格区间
node scripts/price-alert.js
```

## 价格数据源

- 金属价格：[gold-api.com](https://gold-api.com)（XAU/XAG/XPT/XPD，USD/盎司）
- 汇率：[open.er-api.com](https://open.er-api.com)（USD/CNY）
- 换算公式：`(USD/盎司 ÷ 31.1035) × USD/CNY汇率 = 人民币/克`

## License

MIT
