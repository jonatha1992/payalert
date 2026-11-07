import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
let sha = "unknown";
try {
  sha = execSync("git rev-parse --short HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "unknown";
} catch {
  sha = process.env.GIT_SHA || "unknown";
}

const versionData = { version: pkg.version || "0.1.0", sha };
const payload = JSON.stringify(versionData, null, 2) + String.fromCharCode(10);

for (const dir of [path.join(root, "public")]) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "version.json"), payload, "utf8");
}
console.log("Wrote version.json:", JSON.stringify(versionData));