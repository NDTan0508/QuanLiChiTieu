import {
  BarChart3,
  LayoutDashboard,
  LineChart,
  PiggyBank,
  Settings,
} from "lucide-react";

export type AppNavPage =
  | "dashboard"
  | "accumulation"
  | "investment"
  | "reports"
  | "settings";

export function AppNav({
  page,
  setPage,
}: {
  page: AppNavPage;
  setPage: (page: AppNavPage) => void;
}) {
  const items: Array<{ id: AppNavPage; label: string; icon: JSX.Element }> = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { id: "reports", label: "Báo cáo", icon: <BarChart3 size={18} /> },
    { id: "investment", label: "Tài sản", icon: <LineChart size={18} /> },
    { id: "accumulation", label: "Tích lũy", icon: <PiggyBank size={18} /> },
    { id: "settings", label: "Cài đặt", icon: <Settings size={18} /> },
  ];

  return (
    <nav className="app-nav">
      <div className="brand">
        <img className="brand-mark" src="/logo.png" alt="Quản Lí" />
        <div>
          <strong>Quản Lí</strong>
          <small>Chi tiêu cá nhân</small>
        </div>
      </div>
      <div className="nav-list">
        {items.map((item) => (
          <button
            className={page === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setPage(item.id)}
            title={item.label}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
