import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const apiUrl = process.env.API_URL?.trim();
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const clientDir = join(repoRoot, "apps", "client");
const targetPath = join(clientDir, ".env.production.local");

if (!apiUrl) {
  console.log("[write-client-env] API_URL is not set. Skipping client env generation.");
  process.exit(0);
}

mkdirSync(clientDir, { recursive: true });
writeFileSync(targetPath, `VITE_API_BASE=${apiUrl}\n`, "utf8");
console.log(`[write-client-env] Wrote ${targetPath}`);
