import { open } from "@tauri-apps/plugin-dialog";
import { ArrowRight, FolderOpen, FolderPlus, Sparkles } from "lucide-react";
import { useState } from "react";
import { ipc } from "../lib/ipc";
import { useVault } from "../store/vaultStore";

type CreateMode = "blank" | "sample";

export function WelcomeScreen() {
  const setVault = useVault((s) => s.setVault);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<{
    mode: CreateMode;
    parent: string;
  } | null>(null);
  const [name, setName] = useState("My Vault");

  const pickFolder = async (title: string) =>
    open({ directory: true, title }) as Promise<string | null>;

  const startCreate = async (mode: CreateMode) => {
    setError(null);
    const parent = await pickFolder("Choose where to create your vault");
    if (parent) setCreating({ mode, parent });
  };

  const confirmCreate = async () => {
    if (!creating || !name.trim()) return;
    try {
      const path = `${creating.parent}/${name.trim()}`;
      await ipc.createVault(path, creating.mode === "sample");
      await setVault(path);
    } catch (e) {
      setError(String(e));
    }
  };

  const openExisting = async () => {
    setError(null);
    const path = await pickFolder("Open an existing folder of notes");
    if (!path) return;
    try {
      await ipc.openVault(path);
      await setVault(path);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="titlebar-drag flex h-full flex-col items-center justify-center bg-paper-deep">
      <div className="fade-up w-[440px]">
        <p className="font-display text-[15px] italic text-ink-faint">
          one vault, one window
        </p>
        <h1 className="mt-1 font-display text-[64px] font-medium leading-none tracking-tight">
          Vault
        </h1>
        <p className="mt-3 max-w-[360px] text-[13.5px] leading-relaxed text-ink-soft">
          A local-first knowledge base. Plain Markdown files, versioned with
          git, owned by you.
        </p>

        {creating === null ? (
          <div className="mt-10 space-y-2">
            <WelcomeAction
              icon={<FolderPlus size={17} />}
              title="Create a new vault"
              hint="Start with an empty folder"
              onClick={() => void startCreate("blank")}
            />
            <WelcomeAction
              icon={<Sparkles size={17} />}
              title="Create a getting-started vault"
              hint="Includes example notes, types and links"
              onClick={() => void startCreate("sample")}
            />
            <WelcomeAction
              icon={<FolderOpen size={17} />}
              title="Open an existing folder"
              hint="Any folder of Markdown files becomes a vault"
              onClick={() => void openExisting()}
            />
          </div>
        ) : (
          <div className="mt-10 rounded-lg border border-line bg-paper p-4">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              Vault name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void confirmCreate()}
              className="mt-1.5 w-full rounded-md border border-line-strong bg-white px-3 py-2 font-display text-[16px] outline-none focus:border-accent"
            />
            <p className="mt-2 truncate text-[12px] text-ink-faint">
              {creating.parent}/{name.trim() || "…"}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => void confirmCreate()}
                className="flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-accent-deep"
              >
                Create vault <ArrowRight size={14} />
              </button>
              <button
                onClick={() => setCreating(null)}
                className="rounded-md px-3 py-1.5 text-[13px] text-ink-soft hover:bg-paper-sunken"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-accent-wash px-3 py-2 text-[12.5px] text-accent-deep">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function WelcomeAction({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3.5 rounded-lg border border-line bg-paper px-4 py-3 text-left transition-colors hover:border-accent/40 hover:bg-white"
    >
      <span className="text-ink-faint transition-colors group-hover:text-accent">
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-[13.5px] font-semibold">{title}</span>
        <span className="block text-[12px] text-ink-faint">{hint}</span>
      </span>
      <ArrowRight
        size={14}
        className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}
