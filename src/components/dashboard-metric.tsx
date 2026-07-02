import type { LucideIcon } from "lucide-react";

type DashboardMetricProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
  tone?: "default" | "mint";
};

export function DashboardMetric({
  icon: Icon,
  label,
  value,
  helper,
  tone = "default"
}: DashboardMetricProps) {
  return (
    <article className="rounded-md border border-white/10 bg-panel/85 p-4 shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-400">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/[0.05] text-mint">
          <Icon size={18} />
        </span>
      </div>
      <p className={`mt-5 text-3xl font-semibold tracking-normal ${tone === "mint" ? "text-mint" : "text-white"}`}>
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-400">{helper}</p>
    </article>
  );
}
