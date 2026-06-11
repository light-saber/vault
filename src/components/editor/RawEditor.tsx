import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { useCallback } from "react";
import { useDebouncedSave } from "../../hooks/useDebouncedSave";

const theme = EditorView.theme({
  "&": { backgroundColor: "transparent" },
  ".cm-gutters": { display: "none" },
  ".cm-activeLine": { backgroundColor: "transparent" },
});

const extensions = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  EditorView.lineWrapping,
];

/** Raw Markdown editor (CodeMirror 6) with the same 500ms debounced save. */
export function RawEditor({ initialBody }: { initialBody: string }) {
  const { schedule } = useDebouncedSave();

  const onChange = useCallback(
    (value: string) => schedule(() => value),
    [schedule],
  );

  return (
    <div className="raw-editor h-full overflow-y-auto">
      <CodeMirror
        value={initialBody}
        onChange={onChange}
        autoFocus
        height="100%"
        theme={theme}
        extensions={extensions}
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
