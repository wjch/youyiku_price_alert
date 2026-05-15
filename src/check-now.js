import { checkPrices } from "./checker.js";

checkPrices().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
