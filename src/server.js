import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addProduct, deleteProduct, loadProducts } from "./products.js";
import { loadState } from "./state.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");

export function createServer({ runJob, isJobRunning }) {
  const app = express();

  app.use(express.json());
  app.use(express.static(publicDir));

  app.get("/healthz", (req, res) => {
    res.json({
      ok: true,
      running: isJobRunning()
    });
  });

  app.get("/api/products", async (req, res, next) => {
    try {
      const [products, state] = await Promise.all([loadProducts(), loadState()]);
      res.json({
        products: products.map((product) => ({
          ...product,
          status: state[product.id] || null
        })),
        running: isJobRunning()
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/products", async (req, res, next) => {
    try {
      const product = await addProduct(req.body || {});
      res.status(201).json({ product });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/products/:id", async (req, res, next) => {
    try {
      await deleteProduct(req.params.id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/check", async (req, res, next) => {
    try {
      if (isJobRunning()) {
        res.status(409).json({ error: "检查任务正在运行中。" });
        return;
      }

      runJob();
      res.status(202).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(400).json({
      error: error.message || "请求失败。"
    });
  });

  return app;
}
