import type { KeyboardEvent, ReactNode } from "react";

export function MetricCard({
  label,
  value,
  subValue,
  subTone,
  icon,
  tone,
  percent,
  trend,
  progress,
  breakdown,
  onClick,
}: {
  label: string;
  value: string;
  subValue?: string;
  subTone?: "success" | "danger";
  icon: ReactNode;
  tone?: string;
  percent?: number;
  trend?: {
    label: string;
    tone?: "success" | "danger" | "neutral";
  };
  progress?: {
    percent: number;
    label: string;
    ariaLabel: string;
  };
  breakdown?: {
    left: { label?: string; value: string; ariaLabel?: string };
    right: { label?: string; value: string; ariaLabel?: string };
  };
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
      className={`metric ${tone ?? ""} ${breakdown ? "has-breakdown" : ""} ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      <span>{icon}</span>
      <div className="metric-content">
        <small>{label} {typeof percent === "number" && <b>{percent}%</b>}</small>
        {breakdown ? (
          <>
            <strong className="metric-current-value">{value}</strong>
            <div className="metric-breakdown">
              <div aria-label={breakdown.left.ariaLabel}>
                {breakdown.left.label && <em>{breakdown.left.label}</em>}
                <strong>{breakdown.left.value}</strong>
              </div>
              <div aria-label={breakdown.right.ariaLabel}>
                {breakdown.right.label && <em>{breakdown.right.label}</em>}
                <strong>{breakdown.right.value}</strong>
              </div>
            </div>
          </>
        ) : (
          <>
            <strong>{value}</strong>
            {progress ? (
              <div className="metric-progress-block">
                <div className="metric-progress-meta">
                  {trend && <b className={trend.tone ? `metric-trend ${trend.tone}` : "metric-trend"}>{trend.label}</b>}
                  <b>{progress.label}</b>
                </div>
                <div className={`metric-progress-track ${trend?.tone ?? "neutral"}`} aria-label={progress.ariaLabel} role="img">
                  <span style={{ width: `${progress.percent}%` }} />
                </div>
              </div>
            ) : (
              trend && <em className={trend.tone ? `metric-trend ${trend.tone}` : "metric-trend"}>{trend.label}</em>
            )}
            {subValue && !progress && <em className={subTone ? `metric-sub ${subTone}` : undefined}>{subValue}</em>}
          </>
        )}
      </div>
    </article>
  );
}
