import "@blocknote/core/fonts/inter.css";
import { filterSuggestionItems } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { useCallback, useEffect, useRef } from "react";
import { ipc } from "../../lib/ipc";
import {
  injectWikilinksIntoBlocks,
  postProcessWikilinks,
  wordCount,
} from "../../lib/wikilinks";
import { useVault } from "../../store/vaultStore";
import { vaultSchema } from "./wikilink";

export function RichEditor({ initialBody }: { initialBody: string }) {
  const editor = useCreateBlockNote({ schema: vaultSchema });
  const loaded = useRef(false);
  const timer = useRef<number | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const blocks = await editor.tryParseMarkdownToBlocks(initialBody);
      if (cancelled) return;
      editor.replaceBlocks(
        editor.document,
        injectWikilinksIntoBlocks(blocks) as typeof blocks,
      );
      loaded.current = true;
    })();
    useVault.getState().setWordCount(wordCount(initialBody));
    return () => {
      cancelled = true;
    };
    // initial load only; remounted per note via key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const flush = useCallback(async () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    dirty.current = false;
    const markdown = postProcessWikilinks(
      await editor.blocksToMarkdownLossy(editor.document),
    );
    useVault.getState().setWordCount(wordCount(markdown));
    await useVault.getState().saveBody(markdown);
  }, [editor]);

  // Debounced 500ms save-on-change; flushed on Cmd+S, quit and unmount.
  const onChange = useCallback(() => {
    if (!loaded.current) return;
    dirty.current = true;
    useVault.getState().setSaveStatus("dirty");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 500);
  }, [flush]);

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

  return (
    <BlockNoteView
      editor={editor}
      onChange={onChange}
      theme="light"
      className="h-full"
    >
      <SuggestionMenuController
        triggerCharacter="[["
        getItems={async (query) =>
          filterSuggestionItems(wikilinkItems(editor, query), query)
        }
      />
    </BlockNoteView>
  );
}

type VaultEditor = typeof vaultSchema.BlockNoteEditor;

function wikilinkItems(
  editor: VaultEditor,
  query: string,
): DefaultReactSuggestionItem[] {
  const { entries } = useVault.getState();
  const insert = (title: string) => {
    editor.insertInlineContent([
      { type: "wikilink", props: { title } },
      " ",
    ]);
  };

  const items: DefaultReactSuggestionItem[] = entries
    .filter((e) => e.noteType !== "type")
    .map((e) => ({
      title: e.title,
      subtext: e.path,
      onItemClick: () => insert(e.title),
    }));

  const q = query.trim();
  if (q && !entries.some((e) => e.title.toLowerCase() === q.toLowerCase())) {
    items.push({
      title: `Create “${q}”`,
      subtext: "New linked note",
      onItemClick: () => {
        const s = useVault.getState();
        const vault = s.settings.vaultPath;
        if (!vault) return;
        void ipc.createNote(vault, q, null).then((path) => {
          void s.refreshEntry(path);
        });
        insert(q);
      },
    });
  }
  return items.slice(0, 12);
}
