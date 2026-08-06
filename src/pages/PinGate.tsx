import { useState } from "react";
import { ChevronLeft, Lock, X } from "lucide-react";

function PinKeypad({
  disabled,
  onDigit,
  onBackspace,
  onClear,
}: {
  disabled: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}) {
  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="pin-keypad" aria-label="Bàn phím PIN">
      {digits.map((digit) => (
        <button key={digit} type="button" disabled={disabled} onClick={() => onDigit(digit)}>
          {digit}
        </button>
      ))}
      <button className="pin-keypad-action" type="button" disabled={disabled} onClick={onClear} aria-label="Xóa toàn bộ PIN">
        <X size={18} />
      </button>
      <button type="button" disabled={disabled} onClick={() => onDigit("0")}>
        0
      </button>
      <button className="pin-keypad-action" type="button" disabled={disabled} onClick={onBackspace} aria-label="Xóa một số">
        <ChevronLeft size={20} />
      </button>
    </div>
  );
}

export function PinGate({
  hasPin,
  cloudConfigured,
  onUnlock,
}: {
  hasPin: boolean;
  cloudConfigured: boolean;
  onUnlock: (pin: string) => Promise<string | null>;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isSetup = !hasPin;
  const addDigit = (digit: string) => {
    setError("");
    setPin((current) => `${current}${digit}`.slice(0, 12));
  };

  const submit = async () => {
    if (pin.length < 4) {
      setError("PIN cần tối thiểu 4 số.");
      return;
    }
    if (cloudConfigured) {
      setLoading(true);
      setError("");
      const loginError = await onUnlock(pin);
      setLoading(false);
      if (loginError) setError(loginError);
      return;
    }
    if (isSetup) {
      const setupError = await onUnlock(pin);
      if (setupError) setError(setupError);
      return;
    }
    const loginError = await onUnlock(pin);
    if (loginError) setError(loginError);
  };

  return (
    <main className="pin-screen">
      <section className="pin-card">
        <div className="pin-icon">
          <Lock size={26} />
        </div>
        <h1>Nhập mã PIN</h1>
        <input
          className="pin-display"
          type="text"
          value={pin ? "•".repeat(pin.length) : ""}
          placeholder="Nhập PIN"
          readOnly
          aria-label="PIN đã nhập"
        />
        <PinKeypad
          disabled={loading}
          onDigit={addDigit}
          onBackspace={() => setPin((current) => current.slice(0, -1))}
          onClear={() => setPin("")}
        />
        {error && <span className="form-error">{error}</span>}
        <button className="primary full" disabled={loading} onClick={submit}>
          {loading ? "Đang mở..." : "Mở app"}
        </button>
        <a className="admin-link" href="/admin">Tạo hoặc đổi PIN</a>
      </section>
    </main>
  );
}
