import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const filePath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "App.tsx");
const content = readFileSync(filePath, "utf8");
const bad = new Set();

for (const match of content.matchAll(/"((?:\\.|[^"\\])*)"/g)) {
  const value = match[1];
  if (/[ĐÐ]/.test(value) || /\?[a-zA-Zà-ỹÀ-Ỹ]|[a-zA-Zà-ỹÀ-Ỹ]\?|\?\?/.test(value)) {
    bad.add(value);
  }
}

for (const value of [...bad].sort((a, b) => a.length - b.length)) {
  console.log(JSON.stringify(value));
}
console.log("--- total", bad.size);
