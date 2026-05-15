import { appConfig } from "./config.js";

export async function sendPriceDropNotification({ product, oldPrice, newPrice, checkedAt }) {
  if (!appConfig.feishuBotUrl) {
    console.warn("[feishu] FEISHU_BOT_URL is not set, skip notification.");
    return;
  }

  const text = [
    "优衣库商品降价提醒",
    "",
    `商品：${product.name}`,
    `原价：¥${oldPrice}`,
    `现价：¥${newPrice}`,
    `降幅：¥${(oldPrice - newPrice).toFixed(2)}`,
    `时间：${checkedAt}`,
    `链接：${product.url}`
  ].join("\n");

  const response = await fetch(appConfig.feishuBotUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      msg_type: "text",
      content: {
        text
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[feishu] webhook failed: ${response.status} ${body}`);
  }
}
