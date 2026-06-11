import { useCallback, useEffect, useRef } from "react";
import { useVault } from "../store/vaultStore";

/**
 * Debounced 500ms save-on-change (PRD 6.3.1). The pending edit is flushed
 * on unmount, on app quit (pagehide) and on Cmd+S ("vault:flush-save").
 */
export function useDebouncedSave(delay = 500) {
  const timer = useRef<number | null>(null);
  const pending = useRef<string | null>(null);
  const saveBody = useVault((s) => s.saveBody);
  const setSaveStatus = useVault((s) => s.setSaveStatus);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current !== null) {
      const body = pending.current;
      pending.current = null;
      void saveBody(body);
    }
  }, [saveBody]);

  const schedule = useCallback(
    (body: string) => {
      pending.current = body;
      setSaveStatus("dirty");
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, delay);
    },
    [flush, delay, setSaveStatus],
  );

  useEffect(() => {
    const onFlush = () => flush();
    window.addEventListener("vault:flush-save", onFlush);
    window.addEventListener("pagehide", onFlush);
    return () => {
      window.removeEventListener("vault:flush-save", onFlush);
      window.removeEventListener("pagehide", onFlush);
      flush();
    };
  }, [flush]);

  return { schedule, flush };
}
