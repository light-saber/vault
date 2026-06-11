import { open } from "@tauri-apps/plugin-dialog";
import { Settings2 } from "lucide-react";
import { ipc } from "../../lib/ipc";
import { useVault } from "../../store/vaultStore";
import { Modal } from "../ui";

export function SettingsModal() {
  const settings = useVault((s) => s.settings);
  const setSettingsOpen = useVault((s) => s.setSettingsOpen);
  const patchSettings = useVault((s) => s.patchSettings);
  const setVault = useVault((s) => s.setVault);
  const setRawMode = useVault((s) => s.setRawMode);

  const changeVault = async () => {
    const path = (await open({
      directory: true,
      title: "Choose a vault folder",
    })) as string | null;
    if (!path) return;
    await ipc.openVault(path);
    await setVault(path);
    setSettingsOpen(false);
  };

  return (
    <Modal onClose={() => setSettingsOpen(false)} width="w-[520px]">
      <div className="p-5">
        <p className="flex items-center gap-2 text-[13px] font-bold">
          <Settings2 size={15} className="text-accent" />
          Settings
        </p>

        <Section title="Vault">
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-paper-deep px-2 py-1.5 font-mono text-[11px] text-ink-soft">
              {settings.vaultPath}
            </code>
            <button
              onClick={() => void changeVault()}
              className="shrink-0 rounded-md border border-line-strong px-2.5 py-1.5 text-[12px] font-semibold hover:border-accent hover:text-accent"
            >
              Change Vault…
            </button>
          </div>
          <p className="mt-1.5 text-[11.5px] text-ink-faint">
            Vault keeps one active vault. Changing it reloads the app with the
            new folder.
          </p>
        </Section>

        <Section title="Editor">
          <label className="flex items-center justify-between text-[12.5px]">
            Default editor mode
            <select
              value={settings.editorMode ?? "rich"}
              onChange={(e) => {
                void patchSettings({
                  editorMode: e.target.value as "rich" | "raw",
                });
                setRawMode(e.target.value === "raw");
              }}
              className="rounded-md border border-line-strong bg-white px-2 py-1 text-[12px] outline-none"
            >
              <option value="rich">Rich text</option>
              <option value="raw">Raw Markdown</option>
            </select>
          </label>
          <label className="mt-3 flex items-center justify-between text-[12.5px]">
            Zoom
            <span className="flex items-center gap-2">
              <input
                type="range"
                min={0.8}
                max={1.4}
                step={0.05}
                value={settings.zoom ?? 1}
                onChange={(e) =>
                  void patchSettings({ zoom: Number(e.target.value) })
                }
                className="accent-accent"
              />
              <span className="w-10 text-right tabular-nums text-ink-soft">
                {Math.round((settings.zoom ?? 1) * 100)}%
              </span>
            </span>
          </label>
        </Section>

        <Section title="Git">
          <NumberRow
            label="AutoGit — commit after idle minutes"
            value={settings.autoGitMinutes ?? 5}
            onChange={(n) => void patchSettings({ autoGitMinutes: n })}
          />
          <NumberRow
            label="Auto-sync interval (minutes, needs remote)"
            value={settings.autoSyncMinutes ?? 10}
            onChange={(n) => void patchSettings({ autoSyncMinutes: n })}
          />
          <p className="mt-1.5 text-[11.5px] text-ink-faint">
            Bring your own remote: add one with{" "}
            <code className="font-mono">git remote add origin …</code> inside
            the vault folder.
          </p>
        </Section>

        <p className="mt-5 border-t border-line pt-3 text-[11px] text-ink-faint">
          Vault 0.1.0 — local-first, plain Markdown, AGPL-3.0. Your notes never
          leave this machine unless you push them.
        </p>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
        {title}
      </p>
      {children}
    </div>
  );
}

function NumberRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="mt-2 flex items-center justify-between text-[12.5px]">
      {label}
      <input
        type="number"
        min={1}
        max={120}
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        className="w-16 rounded-md border border-line-strong bg-white px-2 py-1 text-right text-[12px] outline-none focus:border-accent"
      />
    </label>
  );
}
