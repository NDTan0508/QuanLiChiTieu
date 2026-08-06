import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const filePath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "App.tsx");
const content = readFileSync(filePath, "utf8");
const lines = content.split("\n");
const hits = [];

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  if (/^\s*(meta|dueDate|createdAt|type|action|entity|placeholder|inputMode|planLink|amountVnd|targetFund|beforeSummary|afterSummary|backupMeta|confirmedAt|btcAmount|stockAmount|savingAmount|emergencyAmount|totalSaving|parentId|childId|settledAt|settledAmount|product|certificate|createdFrom|buyPrice|sharesTouched|statusNote|lastRunAt|btcAmountOverride|averagePrice|costVnd|planId|btcSource|solSource|usdtSource|isFallback|lastError|relatedPayloads|lastExportAt|lastRestoreAt)\?:/.test(line)) continue;
  if (/\.(map|find|filter|reduce|slice|split|lastIndexOf|forEach|length)\?\./.test(line)) continue;
  if (/[A-Za-z0-9_]\?\./.test(line) && !/label>|title=|placeholder=|setError|commitWithUndo|small>|h[1-6]>|option/.test(line)) continue;
  if (/[Đ][a-zà-ỹ]|[a-zà-ỹ][Đ]/.test(line)) hits.push(`${i + 1}: ${line.trim().slice(0, 120)}`);
  else if (/[^:?]\?[a-zà-ỹà-ỹ]|[a-zà-ỹà-ỹ]\?[a-zà-ỹà-ỹ]|\?\?[a-zà-ỹà-ỹ]/.test(line) && !/\?ids=|\?sort=|\?symbol=|\?account_id=|\?job_name=|\?select=|\?order=|\?limit=|\?table=|\?q=/.test(line)) {
    hits.push(`${i + 1}: ${line.trim().slice(0, 120)}`);
  }
}

console.log(`Remaining suspicious lines: ${hits.length}`);
hits.slice(0, 60).forEach((hit) => console.log(hit));
