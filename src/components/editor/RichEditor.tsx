import { filterSuggestionItems } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { useCallback, useEffect, useRef } from "react";
import { useDebouncedSave } from "../../hooks/useDebouncedSave";
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
  const { schedule } = useDebouncedSave();

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

  const onChange = useCallback(() => {
    if (!loaded.current) return;
    // conversion runs once at flush time, not per keystroke
    schedule(async () =>
      postProcessWikilinks(await editor.blocksToMarkdownLossy(editor.document)),
    );
  }, [editor, schedule]);

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
