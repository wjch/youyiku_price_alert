import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { appConfig } from "./config.js";

export async function loadProducts() {
  const filePath = path.resolve(appConfig.productsFile);

  try {
    const content = await fs.readFile(filePath, "utf8");
    const products = JSON.parse(content);

    if (!Array.isArray(products)) {
      throw new Error(`${appConfig.productsFile} must contain a product array.`);
    }

    for (const product of products) {
      if (!product.id || !product.name || !product.url) {
        throw new Error("Each product must include id, name, and url.");
      }
    }

    return products;
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function addProduct({ name, url }) {
  const normalizedUrl = normalizeUniqloUrl(url);
  const products = await loadProducts();
  const id = getProductIdFromUrl(normalizedUrl);

  if (products.some((product) => product.id === id || product.url === normalizedUrl)) {
    throw new Error("这个商品已经在监控列表里了。");
  }

  const product = {
    id,
    name: normalizeName(name, id),
    url: normalizedUrl
  };

  products.push(product);
  await saveProducts(products);
  return product;
}

export async function deleteProduct(id) {
  const products = await loadProducts();
  const nextProducts = products.filter((product) => product.id !== id);

  if (nextProducts.length === products.length) {
    throw new Error("没有找到要删除的商品。");
  }

  await saveProducts(nextProducts);
}

async function saveProducts(products) {
  const filePath = path.resolve(appConfig.productsFile);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(products, null, 2)}\n`, "utf8");
}

function normalizeUniqloUrl(value) {
  if (!value || typeof value !== "string") {
    throw new Error("请输入商品链接。");
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("商品链接格式不正确。");
  }

  if (!/(\.|^)uniqlo\.cn$/i.test(url.hostname)) {
    throw new Error("只支持 uniqlo.cn 的商品链接。");
  }

  if (!url.searchParams.get("productCode")) {
    throw new Error("链接里需要包含 productCode。");
  }

  return url.toString();
}

function getProductIdFromUrl(url) {
  const productCode = new URL(url).searchParams.get("productCode");
  return productCode || crypto.randomUUID();
}

function normalizeName(name, id) {
  const value = typeof name === "string" ? name.trim() : "";
  return value || `优衣库商品 ${id}`;
}
