import { useVault } from "../../store/vaultStore";
import { Kbd } from "../ui";
import { Breadcrumb } from "./Breadcrumb";
import { RawEditor } from "./RawEditor";
import { RichEditor } from "./RichEditor";

export function EditorPane({ standalone = false }: { standalone?: boolean }) {
  const note = useVault((s) => s.note);
  const activePath = useVault((s) => s.activePath);
  const noteKey = useVault((s) => s.noteKey);
  const rawMode = useVault((s) => s.rawMode);

  if (!note || !activePath) {
    return (
      <div className="editor-surface flex h-full flex-col">
        <div className="titlebar-drag h-12 shrink-0" />
        <div className="flex flex-1 flex-col items-center justify-center pb-24">
          <p className="font-display text-[26px] italic text-ink-faint">
            nothing open
          </p>
          <div className="mt-6 space-y-2 text-[12.5px] text-ink-soft">
            <p>
              <Kbd>⌘P</Kbd> jump to a note
            </p>
            <p>
              <Kbd>⌘N</Kbd> create a note
            </p>
            <p>
              <Kbd>⌘K</Kbd> command palette
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-surface flex h-full flex-col">
      <Breadcrumb standalone={standalone} />
      <div className="min-h-0 flex-1 overflow-y-auto pt-8" key={`${noteKey}-${rawMode}`}>
        {rawMode ? (
          <RawEditor initialBody={note.body} />
        ) : (
          <RichEditor initialBody={note.body} />
        )}
      </div>
    </div>
  );
}
