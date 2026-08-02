import { ChevronLeft, ChevronRight } from "lucide-react";

const formatMonth = (value: string) => {
  const [year, month] = value.split("-");
  return `${month}/${year}`;
};

const shiftMonth = (value: string, delta: number) => {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export function MonthPicker({ month, setMonth }: { month: string; setMonth: (month: string) => void }) {
  return (
    <div className="month-picker">
      <button title="Tháng trước" onClick={() => setMonth(shiftMonth(month, -1))}>
        <ChevronLeft size={18} />
      </button>
      <input
        className="month-picker-input"
        type="month"
        value={month}
        onChange={(event) => {
          if (event.target.value) setMonth(event.target.value);
        }}
        aria-label="Chọn tháng"
      />
      <strong>Tháng {formatMonth(month)}</strong>
      <button title="Tháng sau" onClick={() => setMonth(shiftMonth(month, 1))}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
