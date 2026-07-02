type ProgressBarProps = {
  label: string;
  value: number;
};

export function ProgressBar({ label, value }: ProgressBarProps) {
  const bounded = Math.min(100, Math.max(0, value));

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-medium text-white">{Math.round(bounded)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-mint transition-all duration-500"
          style={{ width: `${bounded}%` }}
        />
      </div>
    </div>
  );
}
