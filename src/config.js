import process from "node:process";
import dotenv from "dotenv";

dotenv.config();

export const appConfig = {
  feishuBotUrl: process.env.FEISHU_BOT_URL,
  feishuBotSecret: process.env.FEISHU_BOT_SECRET,
  timezone: process.env.TIMEZONE || "Asia/Shanghai",
  headless: (process.env.HEADLESS || "true").toLowerCase() !== "false",
  runOnStart: (process.env.RUN_ON_START || "false").toLowerCase() === "true",
  port: Number(process.env.PORT || 3000),
  productsFile: process.env.PRODUCTS_FILE || "config/products.json",
  stateFile: process.env.STATE_FILE || "data/price-state.json"
};
