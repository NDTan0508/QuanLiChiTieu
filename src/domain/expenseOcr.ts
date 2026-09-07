import { expenseFingerprint } from "./expenseLedger";

export type OcrExpenseRow = {
  id: string;
  date: string;
  amount: number;
  description: string;
  bankReference: string;
  fingerprint: string;
  selected: boolean;
};

const parseAmount = (value: string) => Number(value.replace(/[^\d]/g, "")) || 0;

export function extractExpenseOcrRows(text: string): OcrExpenseRow[] {
  const dateMatch = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  // Some account-detail screenshots only show transactions. Keep those rows so
  // the review screen can ask for one shared date for this image.
  const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}` : "";
  const blocks = text
    .replace(/\r/g, "")
    .split(/(?:TI[ỀE]N\s*RA|TIEN\s*RA)/i)
    .slice(1);

  return blocks.flatMap((block, index) => {
    const amountMatch = block.match(/[-−]\s*([\d.,\s]+)\s*(?:VND|Ð|Đ|D)?/i);
    const amount = amountMatch ? parseAmount(amountMatch[1]) : 0;
    if (!amount) return [];
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const description = lines
      .filter((line) => !/[-−]\s*[\d.,\s]+\s*(?:VND|Ð|Đ|D)?/i.test(line))
      .filter((line) => !/^\d{1,2}:\d{2}$/.test(line))
      .filter((line) => !/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(line))
      .slice(0, 2)
      .join(" ")
      .slice(0, 280);
    const bankReference = lines.find((line) => /(?:FT|MB\d|TRACE|MBBMS)[A-Z\d/-]{4,}/i.test(line)) ?? "";
    return [{
      id: `ocr-${index}`,
      date,
      amount,
      description,
      bankReference,
      fingerprint: expenseFingerprint({ date, amount, description, bankReference }),
      selected: true,
    }];
  });
}
