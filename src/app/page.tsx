import { Banknote, CalendarDays, Landmark, PiggyBank, ShieldCheck, Target } from "lucide-react";
import { DashboardMetric } from "@/components/dashboard-metric";
import { MonthlyReview } from "@/components/monthly-review";
import { ProgressBar } from "@/components/progress-bar";
import { PurchaseAdvisor } from "@/components/purchase-advisor";
import { StatusPill } from "@/components/status-pill";
import { financeSnapshot, monthlyReview } from "@/lib/mock-data";
import {
  currency,
  getPurchaseAdvice,
  getWeeklyBudgetStatus,
  percentOfGoal
} from "@/lib/finance";

export default function Home() {
  const weeklyRemaining = financeSnapshot.weeklyBudget - financeSnapshot.spentThisWeek;
  const safeToSpend = Math.max(0, financeSnapshot.checking - financeSnapshot.safetyFloor - financeSnapshot.knownFirstOfMonthBills);
  const weeklyStatus = getWeeklyBudgetStatus(financeSnapshot.spentThisWeek, financeSnapshot.weeklyBudget);
  const vacationProgress = percentOfGoal(financeSnapshot.vacationFund, financeSnapshot.vacationGoal);
  const cashGoalProgress = percentOfGoal(financeSnapshot.totalCash, financeSnapshot.cashGoal);
  const defaultAdvice = getPurchaseAdvice(420, financeSnapshot.checking, financeSnapshot.safetyFloor);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-mint">NorthStar</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white sm:text-5xl">
            Cash clarity for the week ahead
          </h1>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
          First-of-month bills: <span className="font-semibold text-white">{currency(financeSnapshot.knownFirstOfMonthBills)}</span>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardMetric
          icon={Banknote}
          label="Total Cash"
          value={currency(financeSnapshot.totalCash)}
          helper={`${Math.round(cashGoalProgress)}% of ${currency(financeSnapshot.cashGoal)} goal`}
        />
        <DashboardMetric
          icon={Landmark}
          label="Checking Balance"
          value={currency(financeSnapshot.checking)}
          helper={`${currency(financeSnapshot.safetyFloor)} safety floor`}
        />
        <DashboardMetric
          icon={PiggyBank}
          label="Vacation Fund"
          value={currency(financeSnapshot.vacationFund)}
          helper={`${currency(financeSnapshot.weeklyVacationTransfer)} weekly transfer`}
        />
        <DashboardMetric
          icon={ShieldCheck}
          label="Safe To Spend"
          value={currency(safeToSpend)}
          helper="After floor and known bills"
          tone="mint"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-md border border-white/10 bg-panel/85 p-5 shadow-glow">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-400">
                <Target size={18} />
                <h2 className="text-base font-semibold text-white">Goal Progress</h2>
              </div>
              <p className="mt-2 text-3xl font-semibold text-white">{currency(financeSnapshot.totalCash)}</p>
            </div>
            <span className="rounded-md bg-white/5 px-3 py-2 text-sm text-slate-300">
              Goal {currency(financeSnapshot.cashGoal)}
            </span>
          </div>
          <div className="mt-5 space-y-5">
            <ProgressBar label="$30,000 cash goal" value={cashGoalProgress} />
            <ProgressBar label="$20,000 safety floor" value={percentOfGoal(financeSnapshot.checking, financeSnapshot.safetyFloor)} />
          </div>
        </div>

        <div className="rounded-md border border-white/10 bg-panel/85 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-mint" />
              <h2 className="text-base font-semibold text-white">Weekly Budget</h2>
            </div>
            <StatusPill status={weeklyStatus} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div>
              <p className="text-sm text-slate-400">Budget</p>
              <p className="mt-1 text-2xl font-semibold text-white">{currency(financeSnapshot.weeklyBudget)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Spent</p>
              <p className="mt-1 text-2xl font-semibold text-white">{currency(financeSnapshot.spentThisWeek)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Remaining</p>
              <p className="mt-1 text-2xl font-semibold text-mint">{currency(weeklyRemaining)}</p>
            </div>
          </div>
          <ProgressBar label="Weekly spend used" value={percentOfGoal(financeSnapshot.spentThisWeek, financeSnapshot.weeklyBudget)} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-md border border-white/10 bg-panel/85 p-5">
          <h2 className="text-base font-semibold text-white">Vacation Fund</h2>
          <p className="mt-3 text-4xl font-semibold text-white">{currency(financeSnapshot.vacationFund)}</p>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-white/[0.04] p-3">
              <p className="text-slate-400">Weekly transfer</p>
              <p className="mt-1 text-xl font-semibold text-white">{currency(financeSnapshot.weeklyVacationTransfer)}</p>
            </div>
            <div className="rounded-md bg-white/[0.04] p-3">
              <p className="text-slate-400">Goal</p>
              <p className="mt-1 text-xl font-semibold text-white">{currency(financeSnapshot.vacationGoal)}</p>
            </div>
          </div>
          <ProgressBar label="Vacation progress" value={vacationProgress} />
        </div>

        <PurchaseAdvisor snapshot={financeSnapshot} defaultAdvice={defaultAdvice} />
      </section>

      <MonthlyReview months={monthlyReview} />
    </main>
  );
}
