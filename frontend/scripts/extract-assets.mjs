// One-time extraction of the prototype's base64 images into real asset files.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const html = readFileSync(
  fileURLToPath(new URL("../../docs/draft/urbanspace_dashboard.html", import.meta.url)),
  "utf8",
);
const outDir = fileURLToPath(new URL("../src/assets/", import.meta.url));
mkdirSync(outDir, { recursive: true });

const re = /([A-Z_]+)\s*:\s*"data:image\/webp;base64,([^"]+)"/g;
const written = [];
let m;
while ((m = re.exec(html))) {
  const file = `${m[1].toLowerCase()}.webp`;
  writeFileSync(outDir + file, Buffer.from(m[2], "base64"));
  written.push(file);
}
console.log(`wrote ${written.length} assets:`, written.join(", "));
