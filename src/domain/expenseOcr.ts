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

function parseDate(d: string, m: string, y: string): string {
  const day = d.padStart(2, "0");
  const month = m.padStart(2, "0");
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${month}-${day}`;
}

const DATE_REGEX = /\b(0?[1-9]|[12]\d|3[01])\s*[./-]\s*(0?[1-9]|1[0-2])\s*[./-]\s*((?:19|20)?\d{2})\b/;

const isDateHeaderLine = (line: string): boolean =>
  /^\s*[|•·\-]*\s*(?:(?:Hôm nay|Hôm qua|Thứ\s*\S+|Chủ\s*nhật|CN|Ngày)\s*[,:-]?\s*)?(0?[1-9]|[12]\d|3[01])\s*[./-]\s*(0?[1-9]|1[0-2])\s*[./-]\s*((?:19|20)?\d{2})\s*[|•·\-]*\s*$/i.test(
    line
  );

export function extractExpenseOcrRows(text: string): OcrExpenseRow[] {
  const cleanText = text.replace(/\r/g, "");

  const dateGlobalRegex = /\b(0?[1-9]|[12]\d|3[01])\s*[./-]\s*(0?[1-9]|1[0-2])\s*[./-]\s*((?:19|20)?\d{2})\b/g;
  const dateMatches: Array<{ index: number; value: string; isHeader: boolean }> = [];
  let match: RegExpExecArray | null;

  while ((match = dateGlobalRegex.exec(cleanText)) !== null) {
    const lineStart = cleanText.lastIndexOf("\n", match.index) + 1;
    let lineEnd = cleanText.indexOf("\n", match.index);
    if (lineEnd === -1) lineEnd = cleanText.length;
    const line = cleanText.slice(lineStart, lineEnd);

    dateMatches.push({
      index: match.index,
      value: parseDate(match[1], match[2], match[3]),
      isHeader: isDateHeaderLine(line),
    });
  }

  const markers: Array<{ type: "EXPENSE" | "INCOME"; index: number; length: number }> = [];
  const expenseRegex = /(?:TI[ỀE]N\s*RA|TIEN\s*RA)/gi;
  while ((match = expenseRegex.exec(cleanText)) !== null) {
    markers.push({
      type: "EXPENSE",
      index: match.index,
      length: match[0].length,
    });
  }

  const incomeRegex = /(?:TI[ỀE]N\s*V[ÀA]O|TIEN\s*VAO)/gi;
  while ((match = incomeRegex.exec(cleanText)) !== null) {
    markers.push({
      type: "INCOME",
      index: match.index,
      length: match[0].length,
    });
  }

  const txMarkers = markers.sort((a, b) => a.index - b.index);
  if (txMarkers.length === 0) return [];

  const firstTxIndex = txMarkers[0].index;
  const datesBeforeFirstTx = dateMatches.filter((d) => d.index < firstTxIndex);
  let activeDate =
    datesBeforeFirstTx.length > 0 ? datesBeforeFirstTx[datesBeforeFirstTx.length - 1].value : "";

  const firstHeaderDate = dateMatches.find((d) => d.isHeader)?.value ?? "";
  const anyFirstDate = dateMatches[0]?.value ?? "";

  const results: OcrExpenseRow[] = [];

  for (let i = 0; i < txMarkers.length; i++) {
    const current = txMarkers[i];
    const next = txMarkers[i + 1];
    const currentEndIndex = next ? next.index : cleanText.length;

    const dateHeadersBetween = dateMatches.filter(
      (d) => d.index > current.index && d.index < currentEndIndex && d.isHeader
    );

    if (current.type === "EXPENSE") {
      let contentEndIndex = currentEndIndex;
      if (dateHeadersBetween.length > 0) {
        contentEndIndex = Math.min(contentEndIndex, dateHeadersBetween[0].index);
      }

      const block = cleanText.slice(current.index + current.length, contentEndIndex);
      const amountMatch = block.match(/[-−]\s*([\d.,\s]+)\s*(?:VND|Ð|Đ|D)?/i);
      const amount = amountMatch ? parseAmount(amountMatch[1]) : 0;

      if (amount > 0) {
        const lines = block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        const description = lines
          .filter((line) => !/[-−]\s*[\d.,\s]+\s*(?:VND|Ð|Đ|D)?/i.test(line))
          .filter((line) => !/^\d{1,2}:\d{2}$/.test(line))
          .filter((line) => !/^\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{2,4}$/.test(line))
          .filter((line) => !/(?:TI[ỀE]N\s*V[ÀA]O|TIEN\s*VAO)/i.test(line))
          .slice(0, 2)
          .join(" ")
          .slice(0, 280);

        const bankReference =
          lines.find((line) => /(?:FT|MB\d|TRACE|MBBMS)[A-Z\d/-]{4,}/i.test(line)) ?? "";

        let date = activeDate;
        if (!date) {
          const blockDate = block.match(DATE_REGEX);
          date = blockDate
            ? parseDate(blockDate[1], blockDate[2], blockDate[3])
            : firstHeaderDate || anyFirstDate;
        }

        results.push({
          id: `ocr-${results.length}`,
          date,
          amount,
          description,
          bankReference,
          fingerprint: expenseFingerprint({ date, amount, description, bankReference }),
          selected: true,
        });
      }
    }

    if (dateHeadersBetween.length > 0) {
      activeDate = dateHeadersBetween[dateHeadersBetween.length - 1].value;
    }
  }

  return results;
}
