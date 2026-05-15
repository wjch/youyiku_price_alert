import fs from "node:fs/promises";
import path from "node:path";
import { appConfig } from "./config.js";

export async function loadState() {
  try {
    const content = await fs.readFile(appConfig.stateFile, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function saveState(state) {
  const filePath = path.resolve(appConfig.stateFile);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}
