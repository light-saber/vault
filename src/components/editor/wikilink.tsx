import { BlockNoteSchema, defaultInlineContentSpecs } from "@blocknote/core";
import { createReactInlineContentSpec } from "@blocknote/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ipc } from "../../lib/ipc";
import { resolveWikilink } from "../../lib/wikilinks";
import { useVault } from "../../store/vaultStore";

/**
 * Wikilinks are custom inline content. The chip renders its own `[[ ]]`
 * brackets as text so that blocksToMarkdownLossy round-trips back to
 * `[[Title]]` syntax (PRD 8.2).
 */
export const WikilinkInline = createReactInlineContentSpec(
  {
    type: "wikilink",
    propSchema: {
      title: { default: "" },
    },
    content: "none",
  },
  {
    render: (props) => <WikilinkChip title={props.inlineContent.props.title} />,
  },
);

export const vaultSchema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    wikilink: WikilinkInline,
  },
});

function WikilinkChip({ title }: { title: string }) {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<number | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  const onClick = async () => {
    const s = useVault.getState();
    const target = resolveWikilink(s.entries, title);
    if (target) {
      await s.openNote(target.path);
    } else {
      // Obsidian behavior: clicking a missing link creates the note.
      await s.createNote(title, null);
    }
  };

  const onEnter = () => {
    timer.current = window.setTimeout(() => {
      const rect = ref.current?.getBoundingClientRect();
      if (rect) setHover({ x: rect.left, y: rect.bottom + 6 });
    }, 350);
  };

  const onLeave = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setHover(null);
  };

  const exists = !!resolveWikilink(useVault.getState().entries, title);

  return (
    <span
      ref={ref}
      className={`wikilink ${exists ? "" : "wikilink-missing"}`}
      onClick={() => void onClick()}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      [[{title}]]
      {hover && <WikilinkPreview title={title} x={hover.x} y={hover.y} />}
    </span>
  );
}

function WikilinkPreview({ title, x, y }: { title: string; x: number; y: number }) {
  const [preview, setPreview] = useState<{ title: string; text: string } | null>(
    null,
  );

  useEffect(() => {
    const s = useVault.getState();
    const target = resolveWikilink(s.entries, title);
    const vault = s.settings.vaultPath;
    if (!target || !vault) {
      setPreview({ title, text: "Not created yet — click to create." });
      return;
    }
    let cancelled = false;
    ipc
      .readNote(vault, target.path)
      .then((note) => {
        if (cancelled) return;
        const firstParagraph =
          note.body
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .find((p) => p.length > 0) ?? "Empty note";
        setPreview({ title: target.title, text: firstParagraph.slice(0, 280) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [title]);

  if (!preview) return null;
  return createPortal(
    <div
      className="overlay-in fixed z-50 w-72 rounded-lg border border-line bg-paper p-3 shadow-xl"
      style={{ left: Math.min(x, window.innerWidth - 300), top: y }}
    >
      <p className="font-display text-[13.5px] font-semibold">{preview.title}</p>
      <p className="mt-1 line-clamp-4 text-[12px] leading-relaxed text-ink-soft">
        {preview.text}
      </p>
    </div>,
    document.body,
  );
}
