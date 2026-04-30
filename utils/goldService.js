/**
 * 实时金价获取服务 (全球 Open Source 版)
 * 支持: 金(XAU) 银(XAG) 铂(XPT) 钯(XPD) + 金银比
 */

export const fetchLivePrices = () => {
  return new Promise((resolve) => {
    // 四种金属并行请求
    const goldReq = requestGoldApi("XAU");
    const silverReq = requestGoldApi("XAG");
    const platinumReq = requestGoldApi("XPT");
    const palladiumReq = requestGoldApi("XPD");
    const rateReq = requestPublicExchangeRate();

    Promise.all([goldReq, silverReq, platinumReq, palladiumReq, rateReq]).then(
      ([gold, silver, platinum, palladium, rate]) => {
        const result = {};

        if (gold && gold.price) {
          const last = parseFloat(gold.price);
          result.gold = {
            title: "现货黄金 (国际)",
            price_oz: last.toFixed(2),
            price_g: rate ? ((last / 31.1035) * rate).toFixed(2) : null,
            percent: gold.chp ? gold.chp.toFixed(2) + "%" : "实时",
            change: "0.00",
          };
        }

        if (silver && silver.price) {
          const last = parseFloat(silver.price);
          result.silver = {
            title: "现货白银 (国际)",
            price_oz: last.toFixed(2),
            price_g: rate ? ((last / 31.1035) * rate).toFixed(2) : null,
            percent: silver.chp ? silver.chp.toFixed(2) + "%" : "实时",
            change: "0.00",
          };
        }

        if (platinum && platinum.price) {
          const last = parseFloat(platinum.price);
          result.platinum = {
            title: "现货铂金 (国际)",
            price_oz: last.toFixed(2),
            price_g: rate ? ((last / 31.1035) * rate).toFixed(2) : null,
            percent: platinum.chp ? platinum.chp.toFixed(2) + "%" : "实时",
            change: "0.00",
          };
        }

        if (palladium && palladium.price) {
          const last = parseFloat(palladium.price);
          result.palladium = {
            title: "现货钯金 (国际)",
            price_oz: last.toFixed(2),
            price_g: rate ? ((last / 31.1035) * rate).toFixed(2) : null,
            percent: palladium.chp ? palladium.chp.toFixed(2) + "%" : "实时",
            change: "0.00",
          };
        }

        if (rate) {
          result.exchangeRate = rate.toFixed(4);
        }

        // 金银比 = 金价(美元/oz) / 银价(美元/oz)
        if (gold && gold.price && silver && silver.price) {
          result.goldSilverRatio = (
            parseFloat(gold.price) / parseFloat(silver.price)
          ).toFixed(2);
        }

        result.lastUpdate = new Date().toLocaleTimeString("zh-CN", {
          hour12: false,
        });
        resolve(result);
      },
    );
  });
};

const requestGoldApi = (symbol) => {
  return new Promise((resolve) => {
    wx.request({
      url: `https://api.gold-api.com/price/${symbol}`,
      method: "GET",
      success: (res) => resolve(res.data),
      fail: () => resolve(null),
    });
  });
};

const requestPublicExchangeRate = () => {
  return new Promise((resolve) => {
    wx.request({
      url: "https://open.er-api.com/v6/latest/USD",
      method: "GET",
      success: (res) => {
        if (res.data && res.data.rates && res.data.rates.CNY) {
          resolve(parseFloat(res.data.rates.CNY));
        } else {
          resolve(null);
        }
      },
      fail: () => resolve(null),
    });
  });
};
