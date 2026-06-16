import { useEffect, useState } from "react";
import { clearToken, getToken, setToken } from "../lib/ipc.web";

// TokenGate renders as a full-screen overlay when auth is missing or rejected.
// It listens for the `vault:auth-failed` event dispatched by ipc.web.ts on 401
// and re-appears so the user can enter the correct token.
export function TokenGate() {
  const [visible, setVisible] = useState(!getToken());
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const onAuthFailed = () => {
      clearToken();
      setInput("");
      setError("Token rejected — please try again.");
      setVisible(true);
    };
    window.addEventListener("vault:auth-failed", onAuthFailed);
    return () => window.removeEventListener("vault:auth-failed", onAuthFailed);
  }, []);

  if (!visible) return null;

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Token cannot be empty.");
      return;
    }
    setToken(trimmed);
    setError("");
    setVisible(false);
    // Re-init the app now that we have a token.
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper-deep/90 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-paper-sunken bg-paper px-8 py-10 shadow-2xl">
        <h1 className="mb-1 font-display text-2xl font-bold tracking-tight">
          Vault
        </h1>
        <p className="mb-6 text-sm text-ink-soft">
          Enter your server token to continue.
        </p>
        <input
          type="password"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Bearer token"
          className="w-full rounded-lg border border-paper-sunken bg-paper-deep px-3 py-2 text-sm outline-none ring-accent focus:ring-1"
        />
        {error && (
          <p className="mt-2 text-xs text-red-500">{error}</p>
        )}
        <button
          onClick={submit}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Connect
        </button>
      </div>
    </div>
  );
}
