import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const COLORS = ["#f97316", "#14b8a6", "#eab308", "#60a5fa", "#f43f5e", "#a78bfa"];

const formatVnd = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);

export function BreakdownPie({ data }: { data: Array<{ name: string; value: number }> }) {
  const rows = data.filter((item) => item.value > 0);
  if (rows.length === 0) return <div className="empty-chart">Chưa có dữ liệu</div>;
  return (
    <ResponsiveContainer width="100%" height={210}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3}>
          {rows.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatVnd(Number(value))} />
      </PieChart>
    </ResponsiveContainer>
  );
}
