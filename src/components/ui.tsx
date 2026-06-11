import {
  Bookmark,
  Briefcase,
  Calendar,
  FileText,
  Folder,
  Hash,
  Lightbulb,
  MapPin,
  Star,
  User,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "file-text": FileText,
  briefcase: Briefcase,
  user: User,
  calendar: Calendar,
  hash: Hash,
  bookmark: Bookmark,
  folder: Folder,
  lightbulb: Lightbulb,
  "map-pin": MapPin,
  star: Star,
};

export function typeIcon(name: string): LucideIcon {
  return ICONS[name] ?? FileText;
}

export const TYPE_COLORS: Record<string, string> = {
  gray: "text-chip-gray",
  blue: "text-chip-blue",
  green: "text-chip-green",
  orange: "text-chip-orange",
  purple: "text-chip-purple",
  red: "text-accent",
};

export function typeColorClass(color: string): string {
  return TYPE_COLORS[color] ?? TYPE_COLORS.gray;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-chip-green-wash text-chip-green",
  doing: "bg-chip-green-wash text-chip-green",
  open: "bg-chip-green-wash text-chip-green",
  done: "bg-chip-blue-wash text-chip-blue",
  complete: "bg-chip-blue-wash text-chip-blue",
  planned: "bg-chip-purple-wash text-chip-purple",
  waiting: "bg-chip-orange-wash text-chip-orange",
  blocked: "bg-accent-wash text-accent-deep",
  archived: "bg-chip-gray-wash text-chip-gray",
};

export function StatusChip({ status }: { status: string }) {
  const style =
    STATUS_STYLES[status.toLowerCase()] ?? "bg-chip-gray-wash text-chip-gray";
  return (
    <span
      className={`inline-block rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${style}`}
    >
      {status}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line-strong bg-paper px-1 py-px font-ui text-[10px] text-ink-soft">
      {children}
    </kbd>
  );
}

export function Modal({
  onClose,
  children,
  width = "w-[480px]",
}: {
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        className={`overlay-in max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-paper shadow-2xl ${width}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
