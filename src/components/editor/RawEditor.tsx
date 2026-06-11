import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@uiw/react-codemirror";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback } from "react";
import { useDebouncedSave } from "../../hooks/useDebouncedSave";
import { wordCount } from "../../lib/wikilinks";
import { useVault } from "../../store/vaultStore";

const theme = EditorView.theme({
  "&": { backgroundColor: "transparent" },
  ".cm-gutters": { display: "none" },
  ".cm-activeLine": { backgroundColor: "transparent" },
});

/** Raw Markdown editor (CodeMirror 6) with the same 500ms debounced save. */
export function RawEditor({ initialBody }: { initialBody: string }) {
  const { schedule } = useDebouncedSave();
  const setWordCount = useVault((s) => s.setWordCount);

  const onChange = useCallback(
    (value: string) => {
      setWordCount(wordCount(value));
      schedule(value);
    },
    [schedule, setWordCount],
  );

  return (
    <div className="raw-editor h-full overflow-y-auto">
      <CodeMirror
        value={initialBody}
        onChange={onChange}
        autoFocus
        height="100%"
        theme={theme}
        extensions={[
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          EditorView.lineWrapping,
        ]}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        }}
        className="h-full"
      />
    </div>
  );
}
