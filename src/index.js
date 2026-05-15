import cron from "node-cron";
import { appConfig } from "./config.js";
import { checkPrices } from "./checker.js";
import { createServer } from "./server.js";

let running = false;

export async function runJob() {
  if (running) {
    console.log("[job] previous job is still running, skip this round.");
    return;
  }

  running = true;
  try {
    console.log(`[job] start at ${new Date().toISOString()}`);
    await checkPrices();
    console.log(`[job] done at ${new Date().toISOString()}`);
  } catch (error) {
    console.error("[job] failed:", error);
  } finally {
    running = false;
  }
}

cron.schedule("0 0,12 * * *", runJob, {
  timezone: appConfig.timezone
});

console.log(`[scheduler] watching prices at 00:00 and 12:00 (${appConfig.timezone}).`);

const app = createServer({
  runJob,
  isJobRunning: () => running
});

app.listen(appConfig.port, () => {
  console.log(`[server] open http://localhost:${appConfig.port}`);
});

if (appConfig.runOnStart) {
  runJob();
}
