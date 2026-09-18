const STYLES: Record<string, string> = {
  new: "bg-ink-100 text-ink-600",
  contacted: "bg-blue-50 text-blue-700",
  qualifying: "bg-amber-50 text-amber-700",
  qualified: "bg-brand-50 text-brand-700",
  unqualified: "bg-red-50 text-red-700",
  converted: "bg-emerald-50 text-emerald-700",
  dormant: "bg-ink-100 text-ink-400",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] || "bg-ink-100 text-ink-600";
  return (
    <span className={`badge ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "text-brand-600" : score >= 55 ? "text-amber-600" : score >= 30 ? "text-blue-600" : "text-ink-400";
  return <span className={`font-semibold tabular-nums ${color}`}>{Math.round(score)}</span>;
}
