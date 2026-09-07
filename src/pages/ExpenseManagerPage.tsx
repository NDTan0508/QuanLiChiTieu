import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { ArrowLeft, Check, CircleAlert, FileSpreadsheet, Plus, ReceiptText, Trash2, Upload, Undo2, WalletCards } from "lucide-react";
import { recognize } from "tesseract.js";
import { MonthPicker } from "../components/MonthPicker";
import { expenseFingerprint, isCountedExpense, normalizedExpenseStatus, suggestExpenseCategory, type ExpenseImportSession, type ExpensePaymentMethod, type ExpenseSource, type ExpenseStatus, type ExpenseTransaction } from "../domain/expenseLedger";
import { parseExpenseRows, readExpenseWorkbook, type ExpenseColumnMapping, type ExpenseWorkbookPreview, type ParsedExpenseRow } from "../domain/expenseXlsx";
import { extractExpenseOcrRows } from "../domain/expenseOcr";

export type ExpenseManagerCategory = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  keywords?: string[];
  isActive?: boolean;
};

type Props = {
  entries: ExpenseTransaction[];
  categories: ExpenseManagerCategory[];
  sessions: ExpenseImportSession[];
  savedMappings: Record<string, ExpenseColumnMapping>;
  month: string;
  setMonth: (month: string) => void;
  onBack: () => void;
  onAdd: (entry: Omit<ExpenseTransaction, "id" | "month" | "fingerprint">) => void;
  onUpdate: (id: string, patch: Partial<ExpenseTransaction>) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => boolean;
  onBulkCategory: (ids: string[], categoryId: string) => void;
  onAddCategory: (name: string, icon: string, color: string) => void;
  onDeleteCategory: (id: string) => void;
  onImport: (rows: ParsedExpenseRow[], fileName: string, mappingKey: string, mapping: ExpenseColumnMapping, totalDetected: number, source: Extract<ExpenseSource, "xlsx" | "image">) => void;
  onUndoImport: (sessionId: string) => void;
};

const money = (value: number) => `${Math.round(value).toLocaleString("vi-VN")}đ`;
const toInputMoney = (value: string) => value.replace(/[^\d]/g, "");
const parseMoney = (value: string) => Number(value.replace(/[^\d]/g, "")) || 0;
const activeCategories = (categories: ExpenseManagerCategory[]) => categories.filter((category) => category.isActive !== false);
const CATEGORY_ICON_COLORS = ["#fb923c", "#f59e0b", "#a78bfa", "#ec4899", "#34d399", "#60a5fa", "#38bdf8", "#8b5cf6", "#f43f5e", "#e879f9"];
const CATEGORY_ICONS = [
  "🍜", "🍔", "☕", "🍺", "🍰", "🛒", "🛍️", "👕", "👟", "💄", "🧴", "⛽", "🛞", "🔧", "🚗", "🚌", "🚕", "🚆", "✈️", "🏠",
  "🛋️", "🧾", "💡", "📱", "💻", "🎮", "🎧", "📚", "📝", "🎓", "🏥", "💊", "🏋️", "⚽", "🎁", "🎉", "💍", "🐶", "🌿", "🌸",
  "🌳", "🧳", "🏖️", "🍿", "🎬", "🎨", "📷", "💳", "🏦", "💰", "📈", "🔒", "🧰", "🧹", "👶", "🧸", "🍳", "🧋", "🥬", "🚲",
].map((icon, index) => ({ icon, color: CATEGORY_ICON_COLORS[index % CATEGORY_ICON_COLORS.length] }));

export function ExpenseManagerPage({ entries, categories, sessions, savedMappings, month, setMonth, onBack, onAdd, onUpdate, onDelete, onBulkDelete, onBulkCategory, onAddCategory, onDeleteCategory, onImport, onUndoImport }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const dailyChartScroll = useRef<HTMLDivElement>(null);
  const dailyChartDrag = useRef({ active: false, startX: 0, startScrollLeft: 0 });
  const [dateFilter, setDateFilter] = useState("");
  const [status, setStatus] = useState<"all" | ExpenseStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [payment, setPayment] = useState<"all" | ExpensePaymentMethod>("all");
  const [source, setSource] = useState<"all" | ExpenseSource>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [bulkCategory, setBulkCategory] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", note: "", categoryId: "", paymentMethod: "cash" as ExpensePaymentMethod });
  const [newCategory, setNewCategory] = useState<{ name: string; icon: string; color: string }>({ name: "", ...CATEGORY_ICONS[0] });
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [preview, setPreview] = useState<ExpenseWorkbookPreview | null>(null);
  const [previewSelectionAnchorId, setPreviewSelectionAnchorId] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const [previewSource, setPreviewSource] = useState<Extract<ExpenseSource, "xlsx" | "image">>("xlsx");
  const [imageGroupDate, setImageGroupDate] = useState("");
  const [ocrProgress, setOcrProgress] = useState("");
  const [importError, setImportError] = useState("");

  const monthEntries = useMemo(() => entries.filter((entry) => entry.month === month && isCountedExpense(entry)), [entries, month]);
  const total = monthEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const unclassified = monthEntries.filter((entry) => normalizedExpenseStatus(entry) === "unclassified");
  const cashTotal = monthEntries.filter((entry) => entry.paymentMethod === "cash").reduce((sum, entry) => sum + entry.amount, 0);
  const filtered = useMemo(() => monthEntries.filter((entry) => {
    const matchesDate = !dateFilter || entry.date === dateFilter;
    const matchesStatus = status === "all" || normalizedExpenseStatus(entry) === status;
    const matchesCategory = categoryFilter === "all" || entry.categoryId === categoryFilter;
    const matchesPayment = payment === "all" || entry.paymentMethod === payment;
    const matchesSource = source === "all" || entry.source === source;
    return matchesDate && matchesStatus && matchesCategory && matchesPayment && matchesSource;
  }).sort((left, right) => right.date.localeCompare(left.date) || right.amount - left.amount), [monthEntries, dateFilter, status, categoryFilter, payment, source]);
  const categoryTotals = useMemo(() => activeCategories(categories).map((category) => ({ category, total: monthEntries.filter((entry) => entry.categoryId === category.id).reduce((sum, entry) => sum + entry.amount, 0) })).filter((item) => item.total > 0).sort((left, right) => right.total - left.total), [categories, monthEntries]);
  const dailyTotals = useMemo(() => [...new Map(monthEntries.map((entry) => [entry.date, 0])).keys()].sort().map((date) => ({ date, total: monthEntries.filter((entry) => entry.date === date).reduce((sum, entry) => sum + entry.amount, 0) })), [monthEntries]);
  const weeklyTotals = useMemo(() => [1, 2, 3, 4, 5].map((week) => ({ week, total: monthEntries.filter((entry) => Math.floor((Number(entry.date.slice(-2)) - 1) / 7) + 1 === week).reduce((sum, entry) => sum + entry.amount, 0) })).filter((item) => item.total > 0), [monthEntries]);

  const categoryName = (id: string) => categories.find((category) => category.id === id)?.name ?? "Chưa phân loại";
  const duplicateFingerprints = useMemo(() => new Set(entries.map((entry) => entry.fingerprint).filter(Boolean)), [entries]);
  const decorateDuplicates = (next: ExpenseWorkbookPreview) => ({ ...next, expenses: next.expenses.map((row) => ({ ...row, duplicate: duplicateFingerprints.has(row.fingerprint), selected: !duplicateFingerprints.has(row.fingerprint) })) });

  const openWorkbook = async (file?: File) => {
    if (!file) return;
    setImportError("");
    try {
      const loaded = await readExpenseWorkbook(file);
      const saved = savedMappings[loaded.templateKey];
      const withSaved = saved ? { ...loaded, mapping: saved, expenses: parseExpenseRows(loaded.rows, saved) } : loaded;
      if (withSaved.mapping.date === undefined || (withSaved.mapping.debit === undefined && withSaved.mapping.amount === undefined)) setImportError("Không xác định được cột ngày hoặc số tiền. Hãy chọn cột trong phần mapping.");
      setPreview(decorateDuplicates(withSaved));
      setPreviewFileName(file.name);
      setPreviewSource("xlsx");
    } catch (error) {
      setPreview(null);
      setImportError(error instanceof Error ? error.message : "Không thể đọc file XLSX.");
    }
  };

  const openImage = async (file?: File) => {
    if (!file) return;
    setImportError("");
    setImageGroupDate("");
    setOcrProgress("Đang chuẩn bị nhận diện ảnh...");
    try {
      const result = await recognize(file, "eng", { logger: (message) => setOcrProgress(message.status === "recognizing text" ? `Đang đọc ảnh ${Math.round((message.progress ?? 0) * 100)}%` : "Đang nhận diện giao dịch...") });
      const expenses = extractExpenseOcrRows(result.data.text) as ParsedExpenseRow[];
      if (!expenses.length) throw new Error("Không tìm thấy khoản tiền ra. Hãy dùng ảnh rõ hơn hoặc nhập thủ công.");
      setPreview(decorateDuplicates({ headers: [], rows: [], mapping: {}, expenses, templateKey: "ocr-image" }));
      setPreviewFileName(file.name);
      setPreviewSource("image");
      setOcrProgress("");
    } catch (error) {
      setPreview(null);
      setImportError(error instanceof Error ? error.message : "Không thể nhận diện ảnh.");
      setOcrProgress("");
    }
  };

  const changeMapping = (key: keyof ExpenseColumnMapping, value: string) => {
    if (!preview) return;
    const column = Number(value);
    const mapping = { ...preview.mapping, [key]: column >= 0 ? column : undefined };
    setPreview(decorateDuplicates({ ...preview, mapping, expenses: parseExpenseRows(preview.rows, mapping) }));
  };

  const applyImageGroupDate = () => {
    if (!imageGroupDate) {
      setImportError("Hãy chọn ngày cho các khoản tiền từ ảnh này.");
      return;
    }
    setPreview((current) => current ? {
      ...current,
      expenses: current.expenses.map((row) => {
        if (row.date) return row;
        const fingerprint = expenseFingerprint({ date: imageGroupDate, amount: row.amount, description: row.description, bankReference: row.bankReference });
        const duplicate = duplicateFingerprints.has(fingerprint);
        return { ...row, date: imageGroupDate, fingerprint, duplicate, selected: duplicate ? false : row.selected };
      }),
    } : current);
    setImportError("");
  };

  const beginDailyChartDrag = (event: MouseEvent<HTMLDivElement>) => {
    const element = dailyChartScroll.current;
    if (!element) return;
    dailyChartDrag.current = { active: true, startX: event.clientX, startScrollLeft: element.scrollLeft };
  };

  const dragDailyChart = (event: MouseEvent<HTMLDivElement>) => {
    const element = dailyChartScroll.current;
    if (!element || !dailyChartDrag.current.active) return;
    element.scrollLeft = dailyChartDrag.current.startScrollLeft - (event.clientX - dailyChartDrag.current.startX);
  };

  const endDailyChartDrag = () => { dailyChartDrag.current.active = false; };

  const updatePreviewRow = (id: string, patch: Partial<ParsedExpenseRow>) => setPreview((current) => current ? {
    ...current,
    expenses: current.expenses.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, ...patch };
      return { ...next, amount: Math.abs(next.amount), fingerprint: expenseFingerprint({ date: next.date, amount: next.amount, description: next.description, bankReference: next.bankReference }), duplicate: duplicateFingerprints.has(expenseFingerprint({ date: next.date, amount: next.amount, description: next.description, bankReference: next.bankReference })) };
    }),
  } : current);

  const selectPreviewRow = (id: string, event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, select, button, a")) return;
    setPreview((current) => {
      if (!current) return current;
      const targetRow = current.expenses.find((row) => row.id === id);
      if (!targetRow || targetRow.duplicate) return current;
      const ctrlOrMeta = "ctrlKey" in event && (event.ctrlKey || event.metaKey);
      if (event.shiftKey && previewSelectionAnchorId) {
        const anchorIndex = current.expenses.findIndex((row) => row.id === previewSelectionAnchorId);
        const targetIndex = current.expenses.findIndex((row) => row.id === id);
        if (anchorIndex >= 0 && targetIndex >= 0) {
          const start = Math.min(anchorIndex, targetIndex);
          const end = Math.max(anchorIndex, targetIndex);
          return { ...current, expenses: current.expenses.map((row, index) => index >= start && index <= end && !row.duplicate ? { ...row, selected: true } : row) };
        }
      }
      setPreviewSelectionAnchorId(id);
      if (ctrlOrMeta) return { ...current, expenses: current.expenses.map((row) => row.id === id ? { ...row, selected: !row.selected } : row) };
      return { ...current, expenses: current.expenses.map((row) => row.id === id ? { ...row, selected: true } : { ...row, selected: false }) };
    });
  };

  const submitManual = () => {
    const amount = parseMoney(manual.amount);
    if (!amount || !manual.date) return;
    onAdd({ date: manual.date, amount, note: manual.note.trim(), categoryId: manual.categoryId, source: "manual", paymentMethod: manual.paymentMethod, status: manual.categoryId ? "classified" : "unclassified", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setManual((value) => ({ ...value, amount: "", note: "", categoryId: "" }));
    setManualOpen(false);
  };

  const submitImport = () => {
    if (!preview) return;
    const chosen = preview.expenses.filter((row) => row.selected && !row.duplicate);
    if (!chosen.length) return setImportError("Hãy chọn ít nhất một giao dịch không trùng.");
    if (chosen.some((row) => !row.date)) return setImportError("Hãy chọn ngày chung cho các khoản tiền chưa có ngày trước khi import.");
    onImport(chosen, previewFileName, preview.templateKey, preview.mapping, preview.expenses.length, previewSource);
    setPreview(null);
    setPreviewFileName("");
  };

  const selectExpenseRow = (id: string, event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, select, input, a")) return;
    const ctrlOrMeta = "ctrlKey" in event && (event.ctrlKey || event.metaKey);
    if (event.shiftKey && selectionAnchorId) {
      const anchorIndex = filtered.findIndex((entry) => entry.id === selectionAnchorId);
      const targetIndex = filtered.findIndex((entry) => entry.id === id);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const range = filtered.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1).map((entry) => entry.id);
        setSelected((current) => [...new Set([...current, ...range])]);
        return;
      }
    }
    if (ctrlOrMeta) {
      setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
      setSelectionAnchorId(id);
      return;
    }
    setSelected([id]);
    setSelectionAnchorId(id);
  };

  return (
    <div className="expense-manager-page">
      <header className="page-heading expense-heading">
        <div className="expense-heading-actions"><MonthPicker month={month} setMonth={setMonth} /><button className="ghost" type="button" onClick={onBack}><ArrowLeft size={17} /> Về Dashboard</button></div>
      </header>

      <section className="expense-kpi-grid">
        <article className="expense-kpi"><span className="expense-kpi-icon"><WalletCards size={21} /></span><div><small>Tổng chi</small><strong>{money(total)}</strong></div></article>
        <article className="expense-kpi"><span className="expense-kpi-icon"><ReceiptText size={21} /></span><div><small>Khoản chi</small><strong>{monthEntries.length}</strong></div></article>
        <button className="expense-kpi expense-kpi-button" type="button" onClick={() => setStatus("unclassified")}><span className="expense-kpi-icon warning"><CircleAlert size={21} /></span><div><small>Chưa p.loại</small><strong>{unclassified.length}</strong></div></button>
      </section>

      <section className="expense-actions">
        <div className="expense-action-grid">
          <button className="expense-action xlsx" type="button" onClick={() => fileInput.current?.click()}><span className="expense-action-icon"><FileSpreadsheet size={25} /></span><span className="expense-action-cta">Nhập XLSX</span></button>
          <button className="expense-action image" type="button" onClick={() => imageInput.current?.click()}><span className="expense-action-icon"><Upload size={25} /></span><span className="expense-action-cta">Chọn ảnh</span></button>
          <button className="expense-action manual" type="button" onClick={() => setManualOpen((open) => !open)}><span className="expense-action-icon"><Plus size={25} /></span><span className="expense-action-cta">Thêm khoản chi</span></button>
        </div>
        <input ref={fileInput} className="visually-hidden" type="file" accept=".xlsx,.xls" onChange={(event) => { void openWorkbook(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        <input ref={imageInput} className="visually-hidden" type="file" accept="image/*" onChange={(event) => { void openImage(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        {manualOpen && <div className="expense-form"><label>Ngày<input type="date" value={manual.date} onChange={(event) => setManual({ ...manual, date: event.target.value })} /></label><label>Số tiền<input inputMode="numeric" value={manual.amount ? Number(manual.amount).toLocaleString("vi-VN") : ""} onChange={(event) => setManual({ ...manual, amount: toInputMoney(event.target.value) })} placeholder="50.000" /></label><label>Nội dung<input value={manual.note} onChange={(event) => setManual({ ...manual, note: event.target.value })} /></label><label>Danh mục<select value={manual.categoryId} onChange={(event) => setManual({ ...manual, categoryId: event.target.value })}><option value="">Chưa phân loại</option>{activeCategories(categories).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Phương thức<select value={manual.paymentMethod} onChange={(event) => setManual({ ...manual, paymentMethod: event.target.value as ExpensePaymentMethod })}><option value="cash">Tiền mặt</option><option value="bank">Ngân hàng</option><option value="other">Khác</option></select></label><button className="primary" type="button" onClick={submitManual}>Lưu khoản chi</button></div>}
      </section>

      {(preview || importError || ocrProgress) && <section className="panel import-preview"><div className="panel-title"><h2><span>Preview {previewSource === "image" ? "ảnh chụp" : "XLSX"}</span>{previewFileName && <span className="preview-file-name" title={previewFileName}>— {previewFileName}</span>}</h2><button className="ghost" type="button" onClick={() => { setPreview(null); setPreviewSelectionAnchorId(null); setImportError(""); setOcrProgress(""); }}>Hủy</button></div>{ocrProgress && <p className="muted">{ocrProgress}</p>}{importError && <p className="form-error">{importError}</p>}{preview && <>{previewSource === "xlsx" && <div className="mapping-grid">{(["date", "debit", "credit", "amount", "description", "reference"] as Array<keyof ExpenseColumnMapping>).map((key) => <label key={key}>{({ date: "Ngày", debit: "Ghi nợ", credit: "Ghi có", amount: "Số tiền", description: "Nội dung", reference: "Mã giao dịch" }[key])}<select value={preview.mapping[key] ?? -1} onChange={(event) => changeMapping(key, event.target.value)}><option value={-1}>Không dùng</option>{preview.headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header || `Cột ${index + 1}`}</option>)}</select></label>)}</div>}<p className="muted">Tìm thấy {preview.expenses.length} khoản tiền ra; bạn luôn có thể sửa trước khi import.</p><div className="preview-list">{preview.expenses.map((row) => <div className={`preview-row${row.selected && !row.duplicate ? " selected" : ""}${row.duplicate ? " duplicate" : ""}`} key={row.id} onClick={(event) => selectPreviewRow(row.id, event)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectPreviewRow(row.id, event); } }} role="button" tabIndex={row.duplicate ? -1 : 0}><input type="date" value={row.date} onChange={(event) => updatePreviewRow(row.id, { date: event.target.value })} /><input inputMode="numeric" value={row.amount.toLocaleString("vi-VN")} onChange={(event) => updatePreviewRow(row.id, { amount: parseMoney(event.target.value) })} /><input value={row.description} onChange={(event) => updatePreviewRow(row.id, { description: event.target.value })} placeholder="Nội dung" /></div>)}</div><div className="import-footer"><strong>Đã chọn {preview.expenses.filter((row) => row.selected && !row.duplicate).length} khoản · {money(preview.expenses.filter((row) => row.selected && !row.duplicate).reduce((sum, row) => sum + row.amount, 0))}</strong><button className="primary" type="button" onClick={submitImport}>Import khoản đã chọn</button></div></>}</section>}

      {previewSource === "image" && preview?.expenses.some((row) => !row.date) && <section className="panel image-date-assignment"><div><strong>Ảnh này không có ngày giao dịch</strong><p className="muted">Chọn một ngày để áp dụng cho tất cả {preview.expenses.filter((row) => !row.date).length} khoản tiền chưa có ngày trong ảnh.</p></div><label>Ngày áp dụng<input type="date" value={imageGroupDate} onChange={(event) => setImageGroupDate(event.target.value)} /></label><button className="primary" type="button" disabled={!imageGroupDate} onClick={applyImageGroupDate}>Áp dụng cho ảnh này</button></section>}

      <section className="panel expense-list-panel">
        <div className="panel-title"><h2>Danh sách khoản chi</h2><small>{filtered.length} khoản trong {month}</small></div>
        <div className="expense-filters"><label className="search-input expense-date-filter"><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Lọc theo ngày" /></label><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">trạng thái</option><option value="unclassified">Chưa phân loại</option><option value="classified">Đã phân loại</option></select><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">danh mục</option>{activeCategories(categories).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><select value={payment} onChange={(event) => setPayment(event.target.value as typeof payment)}><option value="all">Phương thức</option><option value="bank">Ngân hàng</option><option value="cash">Tiền mặt</option><option value="other">Khác</option></select><select value={source} onChange={(event) => setSource(event.target.value as typeof source)}><option value="all">Nguồn</option><option value="xlsx">XLSX</option><option value="manual">Thủ công</option><option value="image">Ảnh</option></select></div>
        {selected.length > 0 && <div className="bulk-bar"><span>Đã chọn {selected.length} khoản</span><select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)}><option value="">Phân loại</option>{activeCategories(categories).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><button className="primary" disabled={!bulkCategory} type="button" onClick={() => { onBulkCategory(selected, bulkCategory); setSelected([]); setBulkCategory(""); }}>Áp dụng</button><button className="ghost" type="button" onClick={() => { setSelected([]); setSelectionAnchorId(null); }}>Bỏ chọn</button><button className="ghost bulk-delete" type="button" onClick={() => { if (onBulkDelete(selected)) { setSelected([]); setSelectionAnchorId(null); } }}><Trash2 size={15} /> Xóa</button></div>}
        <div className="expense-table"><div className={`expense-table-head${selected.length === 1 ? " editing-note" : ""}`}><span>Ngày</span><span>Nội dung</span><span>Số tiền</span>{selected.length === 1 && <span>Nội dung sửa</span>}<span>Danh mục</span><span /></div>{filtered.map((entry) => { const suggestion = !entry.categoryId ? suggestExpenseCategory(entry.note, categories, entries) : ""; const isSelected = selected.includes(entry.id); const isUnclassified = !entry.categoryId; const isEditingNote = selected.length === 1 && isSelected; return <div className={`expense-table-row${isSelected ? " selected" : ""}${isUnclassified ? " unclassified" : ""}${isEditingNote ? " editing-note" : ""}`} key={entry.id} onClick={(event) => selectExpenseRow(entry.id, event)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectExpenseRow(entry.id, event); } }} role="button" tabIndex={0}><span>{entry.date.split("-").reverse().join("/")}</span><div className="expense-row-note" title={entry.note}><strong>{entry.note || "Không có nội dung"}</strong>{entry.bankReference && <small>{entry.bankReference}</small>}</div><strong className="expense-amount">-{money(entry.amount)}</strong>{isEditingNote && <input className="expense-row-note-editor" value={entry.note} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => onUpdate(entry.id, { note: event.target.value })} placeholder="Nội dung khoản chi" aria-label="Nội dung khoản chi" />}<select value={entry.categoryId} onChange={(event) => onUpdate(entry.id, { categoryId: event.target.value, status: event.target.value ? "classified" : "unclassified" })}><option value="">{suggestion ? `Gợi ý: ${categoryName(suggestion)}` : "Chưa phân loại"}</option>{activeCategories(categories).map((category) => <option key={category.id} value={category.id}>{category.icon} {category.name}</option>)}</select><button className="icon-button danger" title="Xóa khoản chi" type="button" onClick={() => onDelete(entry.id)}><Trash2 size={16} /></button></div>; })}{filtered.length === 0 && <p className="muted empty-state">Chưa có khoản chi phù hợp.</p>}</div>
      </section>

      <aside className="panel expense-classification"><div className="panel-title"><h2>Phân loại khoản chi</h2><small>{unclassified.length} cần xử lý</small></div><div className="expense-category-overview">{unclassified.length > 0 && <button type="button" className={status === "unclassified" ? "active expense-unclassified-overview" : "expense-unclassified-overview"} onClick={() => setStatus(status === "unclassified" ? "all" : "unclassified")}><span className="expense-category-icon">!</span><span className="expense-category-copy"><strong>Chưa phân loại</strong><i><b style={{ width: `${total ? Math.round((unclassified.reduce((sum, entry) => sum + entry.amount, 0) / total) * 100) : 0}%` }} /></i></span><span><strong>{money(unclassified.reduce((sum, entry) => sum + entry.amount, 0))}</strong><small>{total ? Math.round((unclassified.reduce((sum, entry) => sum + entry.amount, 0) / total) * 100) : 0}%</small></span></button>}{categoryTotals.map(({ category, total: categoryTotal }) => { const share = total ? Math.round((categoryTotal / total) * 100) : 0; return <button key={category.id} type="button" className={categoryFilter === category.id ? "active" : ""} onClick={() => setCategoryFilter(categoryFilter === category.id ? "all" : category.id)}><span className="expense-category-icon" style={{ color: category.color ?? "#ff9a36" }}>{category.icon ?? "◌"}</span><span className="expense-category-copy"><strong>{category.name}</strong><i><b style={{ width: `${share}%`, background: category.color ?? "#ff9a36" }} /></i></span><span><strong>{money(categoryTotal)}</strong><small>{share}%</small></span></button>; })}{!categoryTotals.length && !unclassified.length && <p className="muted">Chưa có khoản chi trong tháng này.</p>}</div><div className="expense-classification-total"><span>Tổng chi</span><strong>{money(total)}</strong></div></aside>

      <section className="expense-bottom-grid"><article className="panel expense-chart-card"><div className="panel-title"><h2>Chi tiêu theo ngày</h2><small>{dailyTotals.length} ngày có dữ liệu</small></div><div ref={dailyChartScroll} className={`expense-bars-scroll${dailyTotals.length > 14 ? " has-overflow" : ""}`} onMouseDown={beginDailyChartDrag} onMouseMove={dragDailyChart} onMouseUp={endDailyChartDrag} onMouseLeave={endDailyChartDrag}><div className="expense-bars">{dailyTotals.map((item) => { const max = Math.max(...dailyTotals.map((value) => value.total), 1); return <div key={item.date} title={`${item.date}: ${money(item.total)}`}><span style={{ height: `${Math.max((item.total / max) * 100, 4)}%` }} /><small>{item.date.slice(-2)}</small></div>; })}{!dailyTotals.length && <p className="muted">Chưa có dữ liệu biểu đồ.</p>}</div></div><div className="expense-chart-detail">{dailyTotals.map((item) => <div key={item.date}><span>{item.date.split("-").reverse().join("/")}</span><strong>{money(item.total)}</strong></div>)}</div></article><article className="panel expense-chart-card"><div className="panel-title"><h2>Chi tiêu theo tuần</h2><small>{weeklyTotals.length} tuần có dữ liệu</small></div><div className="expense-bars expense-week-bars">{weeklyTotals.map((item) => { const max = Math.max(...weeklyTotals.map((value) => value.total), 1); return <div key={item.week} title={`Tuần ${item.week}: ${money(item.total)}`}><span style={{ height: `${Math.max((item.total / max) * 100, 4)}%` }} /><small>Tuần {item.week}</small></div>; })}{!weeklyTotals.length && <p className="muted">Chưa có dữ liệu biểu đồ.</p>}</div><div className="expense-chart-detail">{weeklyTotals.map((item) => <div key={item.week}><span>Tuần {item.week}</span><strong>{money(item.total)}</strong></div>)}</div></article></section>

      <section className="two-column">
        <article className="panel expense-category-editor">
          <div className="panel-title"><h2>Danh mục</h2></div>
          <div className="category-add">
            <button className="category-icon-trigger" type="button" title="Chọn icon" style={{ "--category-color": newCategory.color } as CSSProperties} onClick={() => setIconPickerOpen((open) => !open)}>{newCategory.icon}</button>
            <input value={newCategory.name} onChange={(event) => { setSelectedCategoryId(null); setNewCategory({ ...newCategory, name: event.target.value }); }} placeholder="Tên danh mục" />
            <button className="primary" type="button" disabled={!newCategory.name.trim()} onClick={() => { onAddCategory(newCategory.name.trim(), newCategory.icon, newCategory.color); setSelectedCategoryId(null); setNewCategory({ name: "", ...CATEGORY_ICONS[0] }); }}><Plus size={16} /> Thêm</button>
            <button className="ghost category-delete" type="button" disabled={!selectedCategoryId} onClick={() => { if (!selectedCategoryId) return; onDeleteCategory(selectedCategoryId); setSelectedCategoryId(null); setNewCategory({ name: "", ...CATEGORY_ICONS[0] }); }}><Trash2 size={15} /> Xóa</button>
          </div>
          {iconPickerOpen && <div className="category-icon-picker" aria-label="Chọn icon danh mục">{CATEGORY_ICONS.map((item) => <button key={item.icon} type="button" title="Chọn icon" className={newCategory.icon === item.icon ? "active" : ""} style={{ "--category-color": item.color } as CSSProperties} onClick={() => { setSelectedCategoryId(null); setNewCategory({ ...newCategory, ...item }); setIconPickerOpen(false); }}>{item.icon}</button>)}</div>}
          <div className="category-chips">{categories.filter((category) => category.isActive !== false).map((category) => <button key={category.id} type="button" className={selectedCategoryId === category.id ? "active" : ""} style={{ "--category-color": category.color ?? "#f97316" } as CSSProperties} onClick={() => { setSelectedCategoryId(category.id); setNewCategory({ name: category.name, icon: category.icon ?? "◌", color: category.color ?? "#f97316" }); }}>{category.icon} {category.name}</button>)}</div>
        </article>
        <article className="panel"><div className="panel-title"><h2>Lịch sử nhập</h2></div><div className="import-history">{sessions.filter((session) => session.status === "completed").slice(0, 10).map((session) => <div key={session.id}><span className="import-history-copy"><FileSpreadsheet size={17} /><strong title={session.fileName}>{session.fileName}</strong><small>{session.totalImported}/{session.totalDetected} đã nhập · {session.totalDuplicate} trùng</small></span><button className="ghost" type="button" onClick={() => onUndoImport(session.id)}><Undo2 size={15} /> Hoàn tác</button></div>)}{!sessions.some((session) => session.status === "completed") && <p className="muted">Chưa có lịch sử nhập XLSX.</p>}</div></article>
      </section>
    </div>
  );
}
