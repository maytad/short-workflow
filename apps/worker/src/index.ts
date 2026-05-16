import { runWorker } from "./loop";

export { runWorker };

if (import.meta.main) {
  runWorker().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
