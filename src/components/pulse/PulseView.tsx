import { FileText, GitCommitHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { dayHeading, timeOfDay } from "../../lib/dates";
import { ipc } from "../../lib/ipc";
import type { CommitInfo } from "../../lib/types";
import { useVault } from "../../store/vaultStore";

const PAGE = 20;

/** Chronological git activity feed, grouped by day (PRD 6.6.3). */
export function PulseView() {
  const vault = useVault((s) => s.settings.vaultPath);
  const openNote = useVault((s) => s.openNote);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [done, setDone] = useState(false);
  const loading = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!vault || loading.current || done) return;
    loading.current = true;
    try {
      const skip = commits.length;
      const page = await ipc.gitLog(vault, skip, PAGE);
      setCommits((prev) => [...prev, ...page]);
      if (page.length < PAGE) setDone(true);
    } finally {
      loading.current = false;
    }
  }, [vault, commits.length, done]);

  useEffect(() => {
    void loadMore();
    // initial page only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver((obs) => {
      if (obs[0]?.isIntersecting) void loadMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const groups: { day: string; commits: CommitInfo[] }[] = [];
  for (const c of commits) {
    const day = dayHeading(c.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.commits.push(c);
    else groups.push({ day, commits: [c] });
  }

  return (
    <div className="flex h-full flex-col bg-paper">
      <div className="titlebar-drag flex h-12 shrink-0 items-end px-3 pb-1.5">
        <span className="text-[13px] font-bold tracking-tight">Pulse</span>
        <span className="ml-2 pb-px text-[11px] text-ink-faint">
          vault activity
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {commits.length === 0 && done && (
          <p className="px-2 pt-8 text-center text-[12.5px] text-ink-faint">
            No commits yet.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.day} className="mb-4">
            <p className="sticky top-0 bg-paper py-1 font-display text-[12.5px] font-semibold italic text-ink-soft">
              {group.day}
            </p>
            <div className="ml-1.5 border-l border-line pl-3">
              {group.commits.map((c) => (
                <div key={c.hash} className="relative py-1.5">
                  <span className="absolute -left-[17.5px] top-[13px] h-2 w-2 rounded-full border border-paper bg-line-strong" />
                  <p className="flex items-baseline gap-2 text-[12.5px]">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {c.message}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-ink-faint">
                      {c.shortHash}
                    </span>
                    <span className="shrink-0 text-[10.5px] tabular-nums text-ink-faint">
                      {timeOfDay(c.timestamp)}
                    </span>
                  </p>
                  {c.files.filter((f) => f.endsWith(".md")).map((f) => (
                    <button
                      key={f}
                      onClick={() => void openNote(f)}
                      className="mt-0.5 flex w-full items-center gap-1.5 truncate rounded px-1 py-0.5 text-left text-[11.5px] text-ink-soft hover:bg-paper-deep hover:text-accent"
                    >
                      <FileText size={10.5} className="shrink-0 text-ink-faint" />
                      <span className="truncate">{f}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={sentinel} className="h-6" />
        {!done && commits.length > 0 && (
          <p className="flex items-center justify-center gap-1.5 pb-2 text-[11px] text-ink-faint">
            <GitCommitHorizontal size={11} /> loading…
          </p>
        )}
      </div>
    </div>
  );
}
