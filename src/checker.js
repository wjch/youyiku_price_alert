import { sendPriceDropNotification } from "./feishu.js";
import { loadProducts } from "./products.js";
import { scrapePrices } from "./scraper.js";
import { loadState, saveState } from "./state.js";

export async function checkPrices() {
  const products = await loadProducts();
  if (products.length === 0) {
    console.log("[job] no products configured.");
    return [];
  }

  const state = await loadState();
  const results = await scrapePrices(products);
  const checkedAt = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false
  });

  for (const result of results) {
    const previous = state[result.product.id];

    if (!result.ok) {
      console.error(`[fail] ${result.product.name}: ${result.error}`);
      state[result.product.id] = {
        ...previous,
        name: result.product.name,
        url: result.product.url,
        lastError: result.error,
        lastCheckedAt: checkedAt
      };
      continue;
    }

    const currentPrice = normalizePrice(result.price);
    console.log(`[ok] ${result.product.name}: ¥${currentPrice}`);

    if (previous?.price && currentPrice < previous.price) {
      await sendPriceDropNotification({
        product: result.product,
        oldPrice: previous.price,
        newPrice: currentPrice,
        checkedAt
      });
      console.log(`[drop] ${result.product.name}: ¥${previous.price} -> ¥${currentPrice}`);
    }

    state[result.product.id] = {
      name: result.product.name,
      url: result.product.url,
      price: currentPrice,
      previousPrice: previous?.price ?? null,
      lastCheckedAt: checkedAt,
      lastError: null
    };
  }

  await saveState(state);
  return results;
}

function normalizePrice(price) {
  return Number(Number(price).toFixed(2));
}
