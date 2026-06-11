import { useCallback, useEffect, useRef } from "react";
import { wordCount } from "../lib/wikilinks";
import { useVault } from "../store/vaultStore";

/** Produces the current Markdown body when the save fires. */
type BodyProducer = () => string | Promise<string>;

/**
 * Debounced 500ms save-on-change (PRD 6.3.1), shared by both editors.
 * The body is produced lazily at flush time so expensive conversions
 * (blocks → Markdown) run once per save, not per keystroke. Pending edits
 * flush on unmount, app quit (pagehide) and Cmd+S ("vault:flush-save").
 */
export function useDebouncedSave(delay = 500) {
  const timer = useRef<number | null>(null);
  const pending = useRef<BodyProducer | null>(null);

  const flush = useCallback(async () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const produce = pending.current;
    if (!produce) return;
    pending.current = null;
    const body = await produce();
    const store = useVault.getState();
    store.setWordCount(wordCount(body));
    await store.saveBody(body);
  }, []);

  const schedule = useCallback(
    (produce: BodyProducer) => {
      pending.current = produce;
      useVault.getState().setSaveStatus("dirty");
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), delay);
    },
    [flush, delay],
  );

  useEffect(() => {
    const onFlush = () => void flush();
    window.addEventListener("vault:flush-save", onFlush);
    window.addEventListener("pagehide", onFlush);
    return () => {
      window.removeEventListener("vault:flush-save", onFlush);
      window.removeEventListener("pagehide", onFlush);
      void flush();
    };
  }, [flush]);

  return { schedule, flush };
}
