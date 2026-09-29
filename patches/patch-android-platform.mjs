import { existsSync, readFileSync, writeFileSync } from "node:fs";

const filePath = process.argv[2];
if (!filePath || !existsSync(filePath)) {
  console.error("Usage: node patch-android-platform.mjs /path/to/coreBundle.js");
  process.exit(1);
}

const MARKER = "/* android-patch */";
let content = readFileSync(filePath, "utf8");

if (content.includes(MARKER)) {
  console.log("Already patched.");
  process.exit(0);
}

const before = content.length;
content = content.replace(
  /if \(process\.platform === "linux"\)/g,
  `if (process.platform === "linux" || process.platform === "android") ${MARKER}`
);

if (content.length === before) {
  console.error("No matching pattern found. Check the file manually.");
  process.exit(1);
}

writeFileSync(filePath, content, "utf8");
console.log("Patched:", filePath);
