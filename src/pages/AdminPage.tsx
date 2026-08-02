import { useState } from "react";
import { Settings } from "lucide-react";

export type AdminActionResult = {
  ok: boolean;
  status: string;
};

export function AdminPage({
  cloudConfigured,
  onUnlockAdmin,
  onCreateAccount,
  onChangeAccountPin,
}: {
  cloudConfigured: boolean;
  onUnlockAdmin: (password: string) => Promise<AdminActionResult>;
  onCreateAccount: (pin: string) => Promise<AdminActionResult>;
  onChangeAccountPin: (oldPin: string, replacementPin: string) => Promise<AdminActionResult>;
}) {
  const [adminPassword, setAdminPassword] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [oldPin, setOldPin] = useState("");
  const [replacementPin, setReplacementPin] = useState("");
  const [status, setStatus] = useState(cloudConfigured ? "Nhập mật khẩu admin để tiếp tục." : "Thiếu cấu hình Supabase.");
  const [loading, setLoading] = useState(false);

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
    if (newPin.length < 4) {
      setStatus("PIN mới cần tối thiểu 4 số.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Đang kiểm tra tài khoản...");
      const result = await onCreateAccount(newPin);
      setStatus(result.status);
      if (result.ok) setNewPin("");
    } catch {
      setStatus("Không tạo được tài khoản. Kiểm tra Supabase hoặc kết nối mạng.");
    } finally {
      setLoading(false);
    }
  };

  const changeAccountPin = async () => {
    if (!cloudConfigured) {
      setStatus("Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (oldPin.length < 4 || replacementPin.length < 4) {
      setStatus("PIN cũ và PIN mới cần tối thiểu 4 số.");
      return;
    }
    if (oldPin === replacementPin) {
      setStatus("PIN mới phải khác PIN cũ.");
      return;
    }

    try {
      setLoading(true);
      setStatus("Đang tải dữ liệu tài khoản cũ...");
      const result = await onChangeAccountPin(oldPin, replacementPin);
      setStatus(result.status);
      if (result.ok) {
        setOldPin("");
        setReplacementPin("");
      }
    } catch {
      setStatus("Không đổi được PIN. Nếu bạn đã tạo bảng trước đó, hãy chạy lại supabase-schema.sql rồi thử lại.");
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
        <p>{adminUnlocked ? "Tạo tài khoản PIN mới hoặc đổi PIN cho tài khoản hiện có." : "Đăng nhập admin để quản lý tài khoản PIN."}</p>

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
                    if (event.key === "Enter") unlockAdmin();
                  }}
                />
              </label>
              <button className="primary full" disabled={loading} onClick={unlockAdmin}>
                {loading ? "Đang kiểm tra..." : "Đăng nhập admin"}
              </button>
            </article>
          </div>
        ) : (
          <div className="admin-stack">
            <article>
              <h2>Tạo tài khoản</h2>
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
              <button className="primary full" disabled={loading || !cloudConfigured} onClick={createAccount}>
                Tạo tài khoản
              </button>
            </article>

            <article>
              <h2>Đổi PIN</h2>
              <label>
                PIN cũ
                <input
                  className="pin-input"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  value={oldPin}
                  onChange={(event) => setOldPin(event.target.value.replace(/\D/g, ""))}
                />
              </label>
              <label>
                PIN mới
                <input
                  className="pin-input"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  value={replacementPin}
                  onChange={(event) => setReplacementPin(event.target.value.replace(/\D/g, ""))}
                />
              </label>
              <button className="primary full" disabled={loading || !cloudConfigured} onClick={changeAccountPin}>
                Đổi PIN
              </button>
            </article>
          </div>
        )}

        <small className={cloudConfigured ? "ok" : "form-error"}>{status}</small>
        <a className="admin-link" href="/">Về app</a>
      </section>
    </main>
  );
}
