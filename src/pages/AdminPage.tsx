import { useState } from "react";
import { KeyRound, RefreshCw, Settings, Trash2, Users } from "lucide-react";
import type { AdminAccountProfile } from "../cloudSync";

export type AdminActionResult = {
  ok: boolean;
  status: string;
};

export function AdminPage({
  cloudConfigured,
  onUnlockAdmin,
  onListAccounts,
  onCreateAccount,
  onChangeAccountPin,
  onDeleteAccount,
}: {
  cloudConfigured: boolean;
  onUnlockAdmin: (password: string) => Promise<AdminActionResult>;
  onListAccounts: () => Promise<AdminAccountProfile[]>;
  onCreateAccount: (alias: string, pin: string) => Promise<AdminActionResult>;
  onChangeAccountPin: (account: AdminAccountProfile, replacementPin: string) => Promise<AdminActionResult>;
  onDeleteAccount: (account: AdminAccountProfile) => Promise<AdminActionResult>;
}) {
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [accounts, setAccounts] = useState<AdminAccountProfile[]>([]);
  const [alias, setAlias] = useState("");
  const [newPin, setNewPin] = useState("");
  const [editingAccountId, setEditingAccountId] = useState("");
  const [replacementPin, setReplacementPin] = useState("");
  const [status, setStatus] = useState(cloudConfigured ? "" : "Thiếu cấu hình Supabase.");
  const [loading, setLoading] = useState(false);

  const refreshAccounts = async () => {
    if (!cloudConfigured) return;
    setAccounts(await onListAccounts());
  };

  const unlockAdmin = async () => {
    if (!adminPassword) {
      setStatus("Nhập mật khẩu admin.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Đang kiểm tra mật khẩu admin...");
      const result = await onUnlockAdmin(adminPassword);
      setStatus(result.status);
      if (result.ok) {
        setAdminUnlocked(true);
        setAdminPassword("");
        try {
          await refreshAccounts();
        } catch {
          setStatus("Đã đăng nhập admin, nhưng chưa tải được danh sách tài khoản. Hãy chạy lại supabase-schema.sql.");
        }
      }
    } catch {
      setStatus("Không kiểm tra được mật khẩu admin.");
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async () => {
    if (!cloudConfigured) {
      setStatus("Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (!alias.trim()) {
      setStatus("Nhập tên tài khoản.");
      return;
    }
    if (newPin.length < 4) {
      setStatus("PIN mới cần tối thiểu 4 số.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Đang tạo tài khoản...");
      const result = await onCreateAccount(alias.trim(), newPin);
      setStatus(result.status);
      if (result.ok) {
        setAlias("");
        setNewPin("");
        await refreshAccounts();
      }
    } catch {
      setStatus("Không tạo được tài khoản. Kiểm tra Supabase hoặc kết nối mạng.");
    } finally {
      setLoading(false);
    }
  };

  const changeAccountPin = async (account: AdminAccountProfile) => {
    if (replacementPin.length < 4) {
      setStatus("PIN mới cần tối thiểu 4 số.");
      return;
    }
    if (account.pin === replacementPin) {
      setStatus("PIN mới phải khác PIN hiện tại.");
      return;
    }

    try {
      setLoading(true);
      setStatus(`Đang đổi PIN cho ${account.alias}...`);
      const result = await onChangeAccountPin(account, replacementPin);
      setStatus(result.status);
      if (result.ok) {
        setEditingAccountId("");
        setReplacementPin("");
        await refreshAccounts();
      }
    } catch {
      setStatus("Không đổi được PIN. Hãy kiểm tra Supabase hoặc kết nối mạng.");
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (account: AdminAccountProfile) => {
    if (!window.confirm(`Xóa tài khoản "${account.alias}" với PIN ${account.pin}? Dữ liệu cloud của tài khoản này sẽ bị xóa vĩnh viễn.`)) return;

    try {
      setLoading(true);
      setStatus(`Đang xóa tài khoản ${account.alias}...`);
      const result = await onDeleteAccount(account);
      setStatus(result.status);
      if (result.ok) await refreshAccounts();
    } catch {
      setStatus("Không xóa được tài khoản. Hãy kiểm tra Supabase hoặc kết nối mạng.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pin-screen">
      <section className="pin-card admin-card">
        <div className="pin-icon">
          <Settings size={26} />
        </div>
        <h1>Admin tài khoản</h1>
        <p>{adminUnlocked ? "Tạo, đổi PIN hoặc xóa tài khoản đang hoạt động." : "Đăng nhập admin để quản lý tài khoản PIN."}</p>

        {!adminUnlocked ? (
          <div className="admin-stack">
            <article>
              <h2>Đăng nhập admin</h2>
              <label>
                Mật khẩu admin
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void unlockAdmin();
                  }}
                />
              </label>
              <button className="primary full" disabled={loading} onClick={() => void unlockAdmin()}>
                {loading ? "Đang kiểm tra..." : "Đăng nhập admin"}
              </button>
            </article>
          </div>
        ) : (
          <div className="admin-stack">
            <article>
              <h2>Tạo tài khoản</h2>
              <label>
                Tên tài khoản
                <input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="Ví dụ: Tài khoản chính" />
              </label>
              <label>
                PIN mới
                <input
                  className="pin-input"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  value={newPin}
                  onChange={(event) => setNewPin(event.target.value.replace(/\D/g, ""))}
                />
              </label>
              <button className="primary full" disabled={loading || !cloudConfigured} onClick={() => void createAccount()}>
                Tạo tài khoản
              </button>
            </article>

            <article className="admin-account-card">
              <div className="admin-account-title">
                <div>
                  <h2>Tài khoản đang hoạt động</h2>
                  <small>{accounts.length} tài khoản</small>
                </div>
                <button className="ghost icon-only" disabled={loading || !cloudConfigured} onClick={() => void refreshAccounts()} title="Tải lại" type="button">
                  <RefreshCw size={16} />
                </button>
              </div>

              {accounts.length === 0 ? (
                <p className="muted">Chưa có metadata tài khoản. Các tài khoản cũ sẽ hiện sau khi tạo mới hoặc đổi PIN qua admin.</p>
              ) : (
                <div className="admin-account-list">
                  {accounts.map((account) => (
                    <div className="admin-account-row" key={account.accountId}>
                      <div className="admin-account-main">
                        <span className="pin-icon mini"><Users size={15} /></span>
                        <div>
                          <strong>{account.alias}</strong>
                          <small>PIN {account.pin} · cập nhật {new Date(account.updatedAt).toLocaleString("vi-VN")}</small>
                        </div>
                      </div>
                      {editingAccountId === account.accountId ? (
                        <div className="admin-account-edit">
                          <input
                            className="pin-input"
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="PIN mới"
                            value={replacementPin}
                            onChange={(event) => setReplacementPin(event.target.value.replace(/\D/g, ""))}
                          />
                          <button className="primary" disabled={loading} onClick={() => void changeAccountPin(account)} type="button">
                            Lưu
                          </button>
                          <button className="ghost" disabled={loading} onClick={() => {
                            setEditingAccountId("");
                            setReplacementPin("");
                          }} type="button">
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <div className="settings-list-actions">
                          <button className="ghost" disabled={loading} onClick={() => {
                            setEditingAccountId(account.accountId);
                            setReplacementPin("");
                          }} type="button">
                            <KeyRound size={15} /> Đổi PIN
                          </button>
                          <button className="ghost danger-action" disabled={loading} onClick={() => void deleteAccount(account)} type="button">
                            <Trash2 size={15} /> Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        )}

        <small className={cloudConfigured ? "ok" : "form-error"}>{status}</small>
        <a className="admin-link" href="/">Về app</a>
      </section>
    </main>
  );
}
