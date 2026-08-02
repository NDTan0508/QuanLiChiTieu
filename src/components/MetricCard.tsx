import type { KeyboardEvent, ReactNode } from "react";

export function MetricCard({
  label,
  value,
  subValue,
  subTone,
  icon,
  tone,
  percent,
  onClick,
}: {
  label: string;
  value: string;
  subValue?: string;
  subTone?: "success" | "danger";
  icon: ReactNode;
  tone?: string;
  percent?: number;
  onClick?: () => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <article
      className={`metric ${tone ?? ""} ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      <span>{icon}</span>
      <div>
        <small>{label} {typeof percent === "number" && <b>{percent}%</b>}</small>
        <strong>{value}</strong>
        {subValue && <em className={subTone ? `metric-sub ${subTone}` : undefined}>{subValue}</em>}
      </div>
    </article>
  );
}
