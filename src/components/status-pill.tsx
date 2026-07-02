import { getBudgetStatusTone, type BudgetStatus } from "@/lib/finance";

type StatusPillProps = {
  status: BudgetStatus;
};

export function StatusPill({ status }: StatusPillProps) {
  const tone = getBudgetStatusTone(status);

  return (
    <span className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tone}`}>
      {status}
    </span>
  );
}
