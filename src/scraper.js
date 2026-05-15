import { chromium } from "playwright";
import { appConfig } from "./config.js";

const PRICE_SELECTORS = [
  "[class*=price]",
  "[class*=Price]",
  "[data-testid*=price]",
  ".product-price",
  ".price",
  "body"
];

export async function scrapePrices(products) {
  const browser = await chromium.launch({
    headless: appConfig.headless
  });

  try {
    const context = await browser.newContext({
      locale: "zh-CN",
      timezoneId: appConfig.timezone,
      viewport: {
        width: 1366,
        height: 900
      },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    });

    const results = [];
    for (const product of products) {
      const page = await context.newPage();
      try {
        const price = await scrapeProductPrice(page, product.url);
        results.push({
          product,
          price,
          ok: true
        });
      } catch (error) {
        results.push({
          product,
          ok: false,
          error: error.message
        });
      } finally {
        await page.close();
      }
    }

    return results;
  } finally {
    await browser.close();
  }
}

async function scrapeProductPrice(page, url) {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });

  await page.waitForLoadState("networkidle", {
    timeout: 30_000
  }).catch(() => {});

  await acceptOptionalCookieBanner(page);

  const jsonPrice = await extractPriceFromStructuredData(page);
  if (jsonPrice !== null) {
    return jsonPrice;
  }

  for (const selector of PRICE_SELECTORS) {
    const texts = await page.locator(selector).allTextContents().catch(() => []);
    const price = extractLowestCnyPrice(texts.join("\n"));
    if (price !== null) {
      return price;
    }
  }

  throw new Error("Cannot find product price on page.");
}

async function acceptOptionalCookieBanner(page) {
  const candidates = ["同意", "接受", "确定", "知道了", "Accept", "OK"];
  for (const text of candidates) {
    const button = page.getByRole("button", { name: text });
    if (await button.first().isVisible().catch(() => false)) {
      await button.first().click().catch(() => {});
      return;
    }
  }
}

async function extractPriceFromStructuredData(page) {
  return page.evaluate(() => {
    const values = [];

    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent || "{}");
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const offer = item.offers || item.offer;
          const offers = Array.isArray(offer) ? offer : [offer];
          for (const entry of offers) {
            const value = Number(entry?.price || entry?.lowPrice || entry?.highPrice);
            if (Number.isFinite(value) && value > 0) {
              values.push(value);
            }
          }
        }
      } catch {
        // Ignore malformed JSON-LD from third-party scripts.
      }
    }

    const nextData = document.querySelector("#__NEXT_DATA__")?.textContent;
    if (nextData) {
      try {
        const json = JSON.parse(nextData);
        collectNumericPrices(json, values);
      } catch {
        // Ignore framework state if it is not JSON.
      }
    }

    return values.length ? Math.min(...values) : null;

    function collectNumericPrices(node, output) {
      if (!node || typeof node !== "object") {
        return;
      }

      for (const [key, value] of Object.entries(node)) {
        if (/^(price|salePrice|currentPrice|promotionPrice|listPrice)$/i.test(key)) {
          const number = Number(String(value).replace(/[^\d.]/g, ""));
          if (Number.isFinite(number) && number > 0) {
            output.push(number);
          }
        }

        if (typeof value === "object") {
          collectNumericPrices(value, output);
        }
      }
    }
  });
}

function extractLowestCnyPrice(text) {
  const matches = [
    ...text.matchAll(/(?:¥|￥|RMB\s*)\s*([1-9]\d{0,5}(?:\.\d{1,2})?)/gi),
    ...text.matchAll(/([1-9]\d{0,5}(?:\.\d{1,2})?)\s*元/g)
  ];

  const prices = matches
    .map((match) => Number(match[1]))
    .filter((price) => Number.isFinite(price) && price > 0);

  return prices.length ? Math.min(...prices) : null;
}
