import { useCallback, useEffect, useRef, useState } from "react";
import { useVault } from "../../store/vaultStore";
import { EditorPane } from "../editor/EditorPane";
import { CommitDialog } from "../git/CommitDialog";
import { Inspector } from "../inspector/Inspector";
import { NoteListPane } from "../notelist/NoteListPane";
import { CommandPalette } from "../palette/CommandPalette";
import { QuickOpen } from "../palette/QuickOpen";
import { SettingsModal } from "../settings/SettingsModal";
import { Sidebar } from "../sidebar/Sidebar";
import { MobileLayout } from "./MobileLayout";
import { StatusBar } from "./StatusBar";

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

interface Widths {
  sidebar: number;
  list: number;
  inspector: number;
}

const LIMITS = {
  sidebar: [150, 400],
  list: [200, 500],
  inspector: [200, 500],
} as const;

function loadWidths(): Widths {
  try {
    const raw = localStorage.getItem("vault:widths");
    if (raw) return { sidebar: 220, list: 300, inspector: 280, ...JSON.parse(raw) };
  } catch {
    // fall through to defaults
  }
  return { sidebar: 220, list: 300, inspector: 280 };
}

export function FourPanelLayout() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileLayout /> : <DesktopLayout />;
}

function DesktopLayout() {
  const inspectorOpen = useVault((s) => s.inspectorOpen);
  const paletteOpen = useVault((s) => s.paletteOpen);
  const quickOpenOpen = useVault((s) => s.quickOpenOpen);
  const commitOpen = useVault((s) => s.commitOpen);
  const settingsOpen = useVault((s) => s.settingsOpen);

  const [widths, setWidths] = useState<Widths>(loadWidths);
  useEffect(() => {
    localStorage.setItem("vault:widths", JSON.stringify(widths));
  }, [widths]);

  const resize = useCallback(
    (panel: keyof Widths, delta: number, start: number) => {
      const [min, max] = LIMITS[panel];
      const dir = panel === "inspector" ? -1 : 1;
      setWidths((w) => ({
        ...w,
        [panel]: Math.min(max, Math.max(min, start + dir * delta)),
      }));
    },
    [],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <div style={{ width: widths.sidebar }} className="shrink-0">
          <Sidebar />
        </div>
        <ResizeHandle onDrag={(d, s) => resize("sidebar", d, s)} width={widths.sidebar} />
        <div style={{ width: widths.list }} className="shrink-0">
          <NoteListPane />
        </div>
        <ResizeHandle onDrag={(d, s) => resize("list", d, s)} width={widths.list} />
        <div className="min-w-0 flex-1">
          <EditorPane />
        </div>
        {inspectorOpen && (
          <>
            <ResizeHandle
              onDrag={(d, s) => resize("inspector", d, s)}
              width={widths.inspector}
            />
            <div style={{ width: widths.inspector }} className="shrink-0">
              <Inspector />
            </div>
          </>
        )}
      </div>
      <StatusBar />

      {paletteOpen && <CommandPalette />}
      {quickOpenOpen && <QuickOpen />}
      {commitOpen && <CommitDialog />}
      {settingsOpen && <SettingsModal />}
    </div>
  );
}

function ResizeHandle({
  onDrag,
  width,
}: {
  onDrag: (delta: number, startWidth: number) => void;
  width: number;
}) {
  const dragging = useRef(false);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startWidth = width;
    document.body.style.cursor = "col-resize";
    const onMove = (ev: MouseEvent) => onDrag(ev.clientX - startX, startWidth);
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      className="relative z-10 -mx-[2px] w-[5px] shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-accent/30"
    >
      <div className="absolute inset-y-0 left-[2px] w-px bg-line" />
    </div>
  );
}
