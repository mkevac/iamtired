import { build as viteBuild } from "vite";
import { rm } from "node:fs/promises";

// Static-only build: emits a plain client bundle to dist/public.
// There is no server — all data lives in the browser (IndexedDB).
async function buildAll() {
  await rm("dist", { recursive: true, force: true });
  console.log("building static client...");
  await viteBuild();
  console.log("done. static site is in dist/public");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
