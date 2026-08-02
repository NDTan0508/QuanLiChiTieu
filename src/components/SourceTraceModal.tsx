import { useMemo } from "react";
import { X } from "lucide-react";
import { buildFinancialIndex } from "../domain/financialIndex";
import type { FinancialEvent } from "../domain/financialTypes";

type SourceTraceState = Parameters<typeof buildFinancialIndex>[0];

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatVnd = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

export function SourceTraceModal({
  state,
  eventIds,
  title,
  onClose,
}: {
  state: SourceTraceState;
  eventIds: string[];
  title: string;
  onClose: () => void;
}) {
  const index = useMemo(() => buildFinancialIndex(state), [state]);
  const selectedEvents = eventIds.map((id) => index.eventsById.get(id)).filter(Boolean) as Array<FinancialEvent>;
  const relatedIds = new Set<string>();
  selectedEvents.forEach((event) => {
    relatedIds.add(event.id);
    event.parentEventIds.forEach((id) => relatedIds.add(id));
    event.childEventIds.forEach((id) => relatedIds.add(id));
    index.parentsByEventId.get(event.id)?.forEach((parent) => relatedIds.add(parent.id));
    index.childrenByEventId.get(event.id)?.forEach((child) => relatedIds.add(child.id));
    if (event.groupId) index.eventsByGroupId.get(event.groupId)?.forEach((groupEvent) => relatedIds.add(groupEvent.id));
  });
  const timeline = [...relatedIds]
    .map((id) => index.eventsById.get(id))
    .filter(Boolean)
    .sort((left, right) => left!.occurredAt.localeCompare(right!.occurredAt)) as Array<FinancialEvent>;
  const relatedEdges = index.edges.filter((edge) => relatedIds.has(edge.fromEventId) || relatedIds.has(edge.toEventId));
  const sourcesIn = relatedEdges.filter((edge) => eventIds.includes(edge.toEventId));

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="source-trace-title">
      <section className="modal-card source-trace-modal">
        <div className="panel-title">
          <h2 id="source-trace-title">{title}</h2>
          <button className="icon-button" onClick={onClose} title="Đóng" type="button">
            <X size={18} />
          </button>
        </div>
        <div className="source-trace-grid">
          <article>
            <h3>Nguồn vào</h3>
            {sourcesIn.length === 0 ? (
              <p className="muted">Chưa có edge nguồn vào trực tiếp.</p>
            ) : (
              sourcesIn.map((edge) => {
                const from = index.eventsById.get(edge.fromEventId);
                return <small key={edge.id}>{from?.label ?? edge.fromEventId} · {edge.relationType} · {edge.confidence}</small>;
              })
            )}
          </article>
          <article>
            <h3>Dữ liệu liên quan</h3>
            <small>{timeline.length} event · {relatedEdges.length} edge</small>
            <small>{selectedEvents.map((event) => event.entityType).filter((value, position, rows) => rows.indexOf(value) === position).join(", ") || "Không có event"}</small>
          </article>
        </div>
        <div className="settings-list source-trace-list">
          {timeline.map((event) => (
            <div className={`settings-list-row ${eventIds.includes(event.id) ? "source-trace-selected" : ""}`} key={event.id}>
              <div>
                <strong>{event.label}</strong>
                <small>{event.entityType} · {event.occurredAt ? formatDateTime(event.occurredAt) : "Chưa có ngày"} · {event.groupId ?? "không group"}</small>
                <small>{event.asset ?? "VND"} {typeof event.quantity === "number" ? event.quantity : ""} {typeof event.amountVnd === "number" ? formatVnd(event.amountVnd) : ""}</small>
              </div>
            </div>
          ))}
        </div>
        <p className="muted">Nếu sửa hoặc xóa event đang chọn, các event cùng group/parent-child ở timeline này có thể cần kiểm tra lại trong Sức khỏe dữ liệu.</p>
      </section>
    </div>
  );
}
