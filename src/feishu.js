import crypto from "node:crypto";
import { appConfig } from "./config.js";

export async function sendFeishuText(text) {
  if (!appConfig.feishuBotUrl) {
    throw new Error("FEISHU_BOT_URL is not set.");
  }

  const payload = {
    msg_type: "text",
    content: {
      text
    }
  };

  if (appConfig.feishuBotSecret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    payload.timestamp = timestamp;
    payload.sign = createFeishuSign(timestamp, appConfig.feishuBotSecret);
  }

  const response = await fetch(appConfig.feishuBotUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[feishu] webhook failed: ${response.status} ${body}`);
  }

  const body = await response.json().catch(() => null);
  if (body && body.code !== undefined && body.code !== 0) {
    throw new Error(`[feishu] webhook failed: ${body.code} ${body.msg || ""}`.trim());
  }

  return body;
}

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

  await sendFeishuText(text);
}

export async function sendFeishuTestMessage() {
  const checkedAt = new Date().toLocaleString("zh-CN", {
    timeZone: appConfig.timezone,
    hour12: false
  });

  await sendFeishuText(
    [
      "优衣库降价监控测试消息",
      "",
      "如果你看到这条消息，说明飞书机器人 webhook 和签名配置正常。",
      `时间：${checkedAt}`
    ].join("\n")
  );
}

export function createFeishuSign(timestamp, secret) {
  const stringToSign = `${timestamp}\n${secret}`;
  return crypto.createHmac("sha256", stringToSign).update("").digest("base64");
}
