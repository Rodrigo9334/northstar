"use client";

import {
  Banknote,
  Compass,
  Landmark,
  PiggyBank,
  ReceiptText,
  RefreshCw,
  Settings as SettingsIcon,
  Target
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth-panel";
import { MonthlyReview } from "@/components/monthly-review";
import { ProgressBar } from "@/components/progress-bar";
import { PurchaseAdvisor } from "@/components/purchase-advisor";
import { StatusPill } from "@/components/status-pill";
import {
  buildFinanceSnapshot,
  buildMonthlyReview,
  type AccountRow,
  type BudgetRow,
  type FinanceSnapshot,
  type GoalRow,
  type ReviewMonth,
  type TransactionRow
} from "@/lib/dashboard-data";
import {
  currency,
  getPurchaseAdvice,
  getWeeklyBudgetStatus,
  percentOfGoal
} from "@/lib/finance";
import { getSupabaseClient } from "@/lib/supabase/client";

declare global {
  interface Window {
    Plaid?: {
      create: (options: {
        onExit?: (error: { error_message?: string } | null) => void;
        onSuccess: (publicToken: string) => void;
        token: string;
      }) => { open: () => void };
    };
  }
}

const emptySnapshot: FinanceSnapshot = {
  checking: 0,
  travelFund: 617,
  travelFundGoal: 3000,
  travelFundYearEndProjection: 617,
  vacationFund: 0,
  totalCash: 0,
  cashGoal: 30000,
  safetyFloor: 20000,
  weeklyBudget: 0,
  spentToday: 0,
  spentThisWeek: 0,
  weeklyCategories: [],
  weeklyTravelContribution: 50,
  weeklyVacationTransfer: 0,
  vacationGoal: 0,
  knownFirstOfMonthBills: 0
};

const navigation = [
  { href: "#home", label: "NorthStar", icon: Compass },
  { href: "#spending", label: "Spending", icon: ReceiptText },
  { href: "#goals", label: "Goals", icon: Target },
  { href: "#settings", label: "Settings", icon: SettingsIcon }
];

type DashboardState = {
  accountCount: number;
  activeAccountCount: number;
  error: string;
  hasFinancialData: boolean;
  isLoading: boolean;
  lastRefreshedAt: string | null;
  monthlyReview: ReviewMonth[];
  snapshot: FinanceSnapshot;
  transactionCount: number;
};

type PlaidItemRow = {
  last_synced_at: string | null;
};

export function NorthStarDashboard() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isConnectingBank, setIsConnectingBank] = useState(false);
  const [isRefreshingDcuData, setIsRefreshingDcuData] = useState(false);
  const [plaidError, setPlaidError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [hasAttemptedTransactionSync, setHasAttemptedTransactionSync] = useState(false);
  const [selectedSpendingCategory, setSelectedSpendingCategory] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardState>({
    accountCount: 0,
    activeAccountCount: 0,
    error: "",
    hasFinancialData: false,
    isLoading: true,
    lastRefreshedAt: null,
    monthlyReview: buildMonthlyReview([]),
    snapshot: emptySnapshot,
    transactionCount: 0
  });

  useEffect(() => {
    if (!supabase) {
      setIsCheckingSession(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsCheckingSession(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session) {
      return;
    }

    loadDashboardData(supabase, setDashboard);
  }, [session, supabase]);

  useEffect(() => {
    if (
      !supabase ||
      !session ||
      hasAttemptedTransactionSync ||
      dashboard.isLoading ||
      dashboard.error ||
      dashboard.accountCount === 0 ||
      dashboard.transactionCount > 0
    ) {
      return;
    }

    setHasAttemptedTransactionSync(true);

    syncTransactionsForConnectedAccounts(supabase, session)
      .then(() => loadDashboardData(supabase, setDashboard))
      .catch((error) => {
        console.error("[dashboard] Transaction sync failed.", error);
      });
  }, [dashboard, hasAttemptedTransactionSync, session, supabase]);

  if (!supabase) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
        <section className="w-full max-w-md rounded-md border border-white/10 bg-panel/90 p-6 shadow-glow">
          <h1 className="text-2xl font-semibold">Supabase is not configured</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to load real NorthStar data.
          </p>
        </section>
      </main>
    );
  }

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-300">
        Loading NorthStar...
      </main>
    );
  }

  if (!session) {
    return <AuthPanel supabase={supabase} />;
  }

  const snapshot = dashboard.snapshot;
  const weeklyRemaining = snapshot.weeklyBudget - snapshot.spentThisWeek;
  const weeklyStatus = getWeeklyBudgetStatus(snapshot.spentThisWeek, snapshot.weeklyBudget || 1);
  const travelProgress = percentOfGoal(snapshot.travelFund, snapshot.travelFundGoal);
  const cashGoalProgress = percentOfGoal(snapshot.totalCash, snapshot.cashGoal);
  const weeklySpendProgress = percentOfGoal(snapshot.spentThisWeek, snapshot.weeklyBudget);
  const defaultAdvice = getPurchaseAdvice(420, snapshot.checking, snapshot.safetyFloor);
  const showRealDashboard = !dashboard.isLoading && !dashboard.error && dashboard.hasFinancialData;
  const showEmptyState = !dashboard.isLoading && !dashboard.error && !dashboard.hasFinancialData;
  const lastRefreshedLabel = formatLastRefreshed(dashboard.lastRefreshedAt);
  const selectedWeeklyCategory =
    snapshot.weeklyCategories.find((category) => category.name === selectedSpendingCategory) ?? null;
  const greeting = getGreeting();
  const todaysInsight =
    snapshot.spentToday === 0
      ? "You haven't spent anything today. Great start."
      : `You spent ${currency(snapshot.spentToday)} today.`;

  async function connectBankAccount() {
    if (!session || !supabase) {
      return;
    }

    setIsConnectingBank(true);
    setPlaidError("");

    try {
      await loadPlaidScript();
      const accessToken = await getSupabaseAccessToken(supabase, session);

      const tokenResponse = await fetch("/api/plaid/create-link-token", {
        cache: "no-store",
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const tokenData = await readJsonResponse<{ error?: string; link_token?: string }>(tokenResponse);

      if (!tokenResponse.ok || !tokenData.link_token) {
        throw new Error(tokenData.error ?? `Could not create Plaid Link token. (${tokenResponse.status})`);
      }

      const plaid = window.Plaid?.create({
        token: tokenData.link_token,
        onExit: (error) => {
          if (error?.error_message) {
            setPlaidError(error.error_message);
          }

          setIsConnectingBank(false);
        },
        onSuccess: async (publicToken) => {
          try {
            const latestAccessToken = await getSupabaseAccessToken(supabase, session);
            const exchangeResponse = await fetch("/api/plaid/exchange-public-token", {
              body: JSON.stringify({ public_token: publicToken }),
              cache: "no-store",
              headers: {
                Authorization: `Bearer ${latestAccessToken}`,
                "Content-Type": "application/json"
              },
              method: "POST"
            });
            const exchangeData = await readJsonResponse<{ error?: string }>(exchangeResponse);

            if (!exchangeResponse.ok) {
              throw new Error(exchangeData.error ?? `Could not save linked bank account. (${exchangeResponse.status})`);
            }

            if (supabase) {
              await loadDashboardData(supabase, setDashboard);
            }
          } catch (error) {
            setPlaidError(error instanceof Error ? error.message : "Could not save linked bank account.");
          } finally {
            setIsConnectingBank(false);
          }
        }
      });

      if (!plaid) {
        throw new Error("Plaid Link could not be loaded.");
      }

      plaid.open();
    } catch (error) {
      setPlaidError(error instanceof Error ? error.message : "Could not open Plaid Link.");
      setIsConnectingBank(false);
    }
  }

  async function refreshDcuData() {
    if (!session || !supabase || isRefreshingDcuData) {
      return;
    }

    setIsRefreshingDcuData(true);
    setRefreshError("");

    try {
      const accessToken = await getSupabaseAccessToken(supabase, session);
      const response = await fetch("/api/plaid/refresh-dcu-data", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        method: "POST"
      });
      const data = await readJsonResponse<{ error?: string }>(response);

      if (!response.ok) {
        throw new Error(data.error ?? `Could not refresh DCU data. (${response.status})`);
      }

      await loadDashboardData(supabase, setDashboard);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Could not refresh DCU data.");
    } finally {
      setIsRefreshingDcuData(false);
    }
  }

  return (
    <main className="min-h-screen pb-24 text-white lg:pb-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:px-8 lg:py-8">
        <aside className="hidden lg:block">
          <div className="sticky top-8 rounded-md border border-white/10 bg-white/[0.04] p-3 shadow-glow backdrop-blur">
            <div className="mb-5 flex items-center gap-3 px-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-ink">
                <Compass size={20} />
              </span>
              <div>
                <p className="text-lg font-semibold">NorthStar</p>
                <p className="text-xs text-slate-400">Live data</p>
              </div>
            </div>
            <nav className="space-y-1" aria-label="Main navigation">
              {navigation.map((item) => {
                const Icon = item.icon;

                return (
                  <a
                    className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                    href={item.href}
                    key={item.href}
                  >
                    <Icon size={17} className="text-mint" />
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <header className="sticky top-0 z-20 -mx-4 border-b border-white/10 bg-ink/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-0">
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-ink">
                  <Compass size={20} />
                </span>
                <div>
                  <p className="text-lg font-semibold">NorthStar</p>
                  <p className="text-xs text-slate-400">Daily briefing</p>
                </div>
              </div>
              <span className="rounded-md border border-white/10 px-3 py-2 text-xs font-medium text-slate-300">
                Live
              </span>
            </div>
          </header>

          {dashboard.error ? (
            <div className="rounded-md border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">
              {dashboard.error}
            </div>
          ) : null}

          {dashboard.isLoading ? (
            <div className="rounded-md border border-white/10 bg-panel/90 px-4 py-3 text-sm text-slate-300">
              Loading your financial data...
            </div>
          ) : null}

          {showEmptyState ? (
            <EmptyFinancialDataState
              error={plaidError}
              isConnecting={isConnectingBank}
              onConnect={connectBankAccount}
            />
          ) : null}

          {showRealDashboard ? (
            <>
              <section id="home" className="scroll-mt-24 overflow-hidden rounded-md border border-white/10 bg-panel/90 shadow-glow">
                <div className="px-5 py-5 sm:px-6 lg:px-7">
                  <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
                    <div className="w-full">
                      <p className="text-sm font-medium uppercase tracking-[0.24em] text-mint">NorthStar</p>
                      <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
                        {greeting}
                      </h1>
                      <div className="mx-auto mt-5 max-w-xl rounded-md border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                          Today's Insight
                        </p>
                        <p className="mt-2 text-base leading-6 text-slate-200">{todaysInsight}</p>
                      </div>
                    </div>
                    <div className="mx-auto w-full max-w-xs rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
                      <button
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isRefreshingDcuData}
                        onClick={refreshDcuData}
                        type="button"
                      >
                        <RefreshCw size={16} className={isRefreshingDcuData ? "animate-spin text-mint" : "text-mint"} />
                        {isRefreshingDcuData ? "Refreshing..." : "Refresh DCU Data"}
                      </button>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Last refreshed: {lastRefreshedLabel}
                      </p>
                      {refreshError ? <p className="mt-2 text-xs leading-5 text-rose">{refreshError}</p> : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="bg-panel p-5 text-center sm:col-span-2 sm:p-6 xl:col-span-3">
                    <div className="flex justify-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-mint/15 text-mint">
                        <Landmark size={18} />
                      </span>
                    </div>
                    <p className="mt-5 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Checking</p>
                    <p className="mt-2 text-4xl font-semibold text-white">{currency(snapshot.checking)}</p>
                    <p className="mt-2 text-sm text-slate-400">{currency(snapshot.safetyFloor)} floor</p>
                  </div>
                  <div className="bg-panel p-5 text-center sm:col-span-2 sm:p-6 xl:col-span-3">
                    <div className="flex items-start justify-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-mint/15 text-mint">
                        <Banknote size={18} />
                      </span>
                      <StatusPill status={weeklyStatus} />
                    </div>
                    <p className="mt-5 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      Remaining This Week
                    </p>
                    <p className="mt-2 text-4xl font-semibold text-mint">{currency(weeklyRemaining)}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      Spent {currency(snapshot.spentThisWeek)} of {currency(snapshot.weeklyBudget)}
                    </p>
                    <ProgressBar label="Weekly spend used" value={weeklySpendProgress} />
                  </div>
                  <div className="bg-panel p-5 text-center sm:p-6">
                    <div className="flex justify-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-mint/15 text-mint">
                        <PiggyBank size={18} />
                      </span>
                    </div>
                    <p className="mt-5 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Travel Fund</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{currency(snapshot.travelFund)}</p>
                    <p className="mt-2 text-sm text-slate-400">
                      {currency(snapshot.weeklyTravelContribution)} weekly contribution
                    </p>
                  </div>
                  <div className="bg-panel p-5 text-center sm:p-6 xl:col-span-2">
                    <div className="flex justify-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-mint/15 text-mint">
                        <Target size={18} />
                      </span>
                    </div>
                    <p className="mt-5 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      $30K Goal Progress
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-mint">{Math.round(cashGoalProgress)}%</p>
                    <p className="mt-2 text-sm text-slate-400">
                      {currency(snapshot.totalCash)} of {currency(snapshot.cashGoal)}
                    </p>
                  </div>
                </div>
              </section>

              <div>
                <PurchaseAdvisor snapshot={snapshot} defaultAdvice={defaultAdvice} />
              </div>

              <section id="spending" className="scroll-mt-24 grid gap-4">
                <div className="rounded-md border border-white/10 bg-panel/90 p-5 shadow-glow sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-mint/15 text-mint">
                      <ReceiptText size={18} />
                    </span>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Section</p>
                      <h2 className="text-xl font-semibold text-white">Spending</h2>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Spent This Week</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{currency(snapshot.spentThisWeek)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Transactions</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{dashboard.transactionCount}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Categories</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{snapshot.weeklyCategories.length}</p>
                    </div>
                  </div>
                  {selectedWeeklyCategory ? (
                    <div className="mt-6">
                      <button
                        className="min-h-10 rounded-md border border-white/10 px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                        onClick={() => setSelectedSpendingCategory(null)}
                        type="button"
                      >
                        Back to categories
                      </button>
                      <div className="mt-5 rounded-md border border-white/10 bg-white/[0.03]">
                        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                              {selectedWeeklyCategory.name}
                            </p>
                            <p className="mt-1 text-sm text-slate-300">
                              {selectedWeeklyCategory.transactions.length} transactions
                            </p>
                          </div>
                          <p className="text-lg font-semibold text-white">{currency(selectedWeeklyCategory.total)}</p>
                        </div>
                        <div className="divide-y divide-white/10">
                          {selectedWeeklyCategory.transactions.map((transaction) => (
                            <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3" key={transaction.id}>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-white">{transaction.merchant}</p>
                                <p className="mt-1 text-xs text-slate-500">{transaction.date}</p>
                              </div>
                              <p className="text-sm font-semibold text-white">{currency(transaction.amount)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : snapshot.weeklyCategories.length > 0 ? (
                    <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {snapshot.weeklyCategories.map((category) => (
                        <button
                          className="flex min-h-12 items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/[0.06]"
                          key={category.name}
                          onClick={() => setSelectedSpendingCategory(category.name)}
                          type="button"
                        >
                          <p className="text-sm text-slate-300">{category.name}</p>
                          <span className="text-sm font-semibold text-white">{currency(category.total)}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <MonthlyReview months={dashboard.monthlyReview} />
              </section>

              <section id="goals" className="scroll-mt-24 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-md border border-white/10 bg-panel/90 p-5 shadow-glow sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gold/15 text-gold">
                      <Target size={18} />
                    </span>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Section</p>
                      <h2 className="text-xl font-semibold text-white">Goals</h2>
                    </div>
                  </div>
                  <div className="mt-6">
                    <p className="text-4xl font-semibold text-white">{currency(snapshot.totalCash)}</p>
                    <p className="mt-2 text-sm text-slate-400">Year-end cash goal: {currency(snapshot.cashGoal)}</p>
                  </div>
                  <ProgressBar label="$30,000 year-end cash goal" value={cashGoalProgress} />
                  <ProgressBar label="$20,000 safety floor" value={percentOfGoal(snapshot.checking, snapshot.safetyFloor)} />
                </div>

                <div className="rounded-md border border-white/10 bg-panel/90 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-mint/15 text-mint">
                      <PiggyBank size={18} />
                    </span>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Goal</p>
                      <h3 className="text-xl font-semibold text-white">Travel Fund</h3>
                    </div>
                  </div>
                  <p className="mt-6 text-4xl font-semibold text-white">{currency(snapshot.travelFund)}</p>
                  <div className="mt-5 grid grid-cols-3 gap-4 border-y border-white/10 py-4 text-sm">
                    <div>
                      <p className="text-slate-500">Weekly</p>
                      <p className="mt-1 text-xl font-semibold text-white">{currency(snapshot.weeklyTravelContribution)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Goal</p>
                      <p className="mt-1 text-xl font-semibold text-white">{currency(snapshot.travelFundGoal)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Year-end</p>
                      <p className="mt-1 text-xl font-semibold text-white">{currency(snapshot.travelFundYearEndProjection)}</p>
                    </div>
                  </div>
                  <ProgressBar label="Travel progress" value={travelProgress} />
                </div>
              </section>

              <section id="settings" className="scroll-mt-24 rounded-md border border-white/10 bg-panel/90 p-5 shadow-glow sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white/[0.06] text-mint">
                    <SettingsIcon size={18} />
                  </span>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Section</p>
                    <h2 className="text-xl font-semibold text-white">Settings</h2>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Active Accounts</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{dashboard.activeAccountCount}</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Weekly Budget</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{currency(snapshot.weeklyBudget)}</p>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Safety Floor</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{currency(snapshot.safetyFloor)}</p>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-6 text-slate-400">
                  Account controls will be added later.
                </p>
              </section>
            </>
          ) : null}
        </div>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-30 rounded-md border border-white/10 bg-ink/95 px-2 py-2 shadow-glow backdrop-blur lg:hidden" aria-label="Mobile navigation">
        <div className="grid grid-cols-4 gap-1">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <a
                className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                href={item.href}
                key={item.href}
              >
                <Icon size={18} className="text-mint" />
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

function EmptyFinancialDataState({
  error,
  isConnecting,
  onConnect
}: {
  error: string;
  isConnecting: boolean;
  onConnect: () => void;
}) {
  return (
    <section className="scroll-mt-24 rounded-md border border-white/10 bg-panel/90 p-6 shadow-glow sm:p-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-mint/15 text-mint">
          <Landmark size={22} />
        </span>
        <p className="mt-6 text-sm font-medium uppercase tracking-[0.24em] text-mint">Today</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl">
          No financial data connected yet
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
          Connect a bank account later to populate balances, transactions, budgets, and goals in this dashboard.
        </p>
        <button
          className="mt-6 min-h-12 rounded-md bg-mint px-5 font-semibold text-ink transition hover:bg-mint/90"
          disabled={isConnecting}
          onClick={onConnect}
          type="button"
        >
          {isConnecting ? "Opening Plaid..." : "Connect bank account"}
        </button>
        {error ? <p className="mt-4 text-sm text-rose">{error}</p> : null}
      </div>
    </section>
  );
}

function loadPlaidScript() {
  if (window.Plaid) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>("script[src='https://cdn.plaid.com/link/v2/stable/link-initialize.js']");

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Could not load Plaid Link.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Plaid Link."));
    document.body.appendChild(script);
  });
}

async function getSupabaseAccessToken(supabase: SupabaseClient, fallbackSession: Session) {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? fallbackSession.access_token;

  if (error || !accessToken) {
    throw new Error("Your Supabase session expired. Sign in again before connecting a bank account.");
  }

  return accessToken;
}

async function readJsonResponse<T extends { error?: string }>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {
      error: response.ok ? undefined : `Request failed with status ${response.status}.`
    } as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      error: response.ok ? "Received an invalid server response." : `Request failed with status ${response.status}.`
    } as T;
  }
}

async function loadDashboardData(
  supabase: SupabaseClient,
  setDashboard: React.Dispatch<React.SetStateAction<DashboardState>>
) {
  setDashboard((current) => ({ ...current, error: "", isLoading: true }));

  const [accountsResult, transactionsResult, budgetsResult, goalsResult, plaidItemsResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("id,available_balance,current_balance,is_active,name,subtype,type")
      .order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select("id,account_id,amount,category,date,merchant_name,name,pending")
      .order("date", { ascending: false })
      .limit(500),
    supabase
      .from("budgets")
      .select("amount,category,is_active,name,period,spent_amount,starts_on")
      .order("starts_on", { ascending: false }),
    supabase
      .from("goals")
      .select("current_amount,name,status,target_amount,weekly_contribution")
      .order("created_at", { ascending: true }),
    supabase
      .from("plaid_items")
      .select("last_synced_at")
      .order("created_at", { ascending: true })
  ]);

  const error =
    accountsResult.error?.message ??
    transactionsResult.error?.message ??
    budgetsResult.error?.message ??
    goalsResult.error?.message ??
    plaidItemsResult.error?.message ??
    "";

  const accounts = (accountsResult.data ?? []) as AccountRow[];
  const transactions = (transactionsResult.data ?? []) as TransactionRow[];
  const budgets = (budgetsResult.data ?? []) as BudgetRow[];
  const goals = (goalsResult.data ?? []) as GoalRow[];
  const plaidItems = (plaidItemsResult.data ?? []) as PlaidItemRow[];
  const activeAccountIds = new Set(
    accounts.filter((account) => account.is_active === true).map((account) => account.id)
  );
  const activeTransactions = transactions.filter((transaction) => activeAccountIds.has(transaction.account_id));
  const hasFinancialData = accounts.length > 0 || transactions.length > 0 || budgets.length > 0 || goals.length > 0;
  const lastRefreshedAt = getMostRecentTimestamp(plaidItems.map((item) => item.last_synced_at));

  setDashboard({
    accountCount: accounts.length,
    activeAccountCount: activeAccountIds.size,
    error,
    hasFinancialData,
    isLoading: false,
    lastRefreshedAt,
    monthlyReview: buildMonthlyReview(activeTransactions),
    snapshot: hasFinancialData ? buildFinanceSnapshot({ accounts, budgets, goals, transactions: activeTransactions }) : emptySnapshot,
    transactionCount: activeTransactions.length
  });
}

async function syncTransactionsForConnectedAccounts(supabase: SupabaseClient, session: Session) {
  const accessToken = await getSupabaseAccessToken(supabase, session);
  const response = await fetch("/api/plaid/sync-transactions", {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    method: "POST"
  });
  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(data.error ?? `Could not sync Plaid transactions. (${response.status})`);
  }
}

function getMostRecentTimestamp(timestamps: Array<string | null>) {
  const newest = timestamps.reduce<number | null>((latest, timestamp) => {
    if (!timestamp) {
      return latest;
    }

    const time = new Date(timestamp).getTime();

    if (Number.isNaN(time)) {
      return latest;
    }

    return latest === null || time > latest ? time : latest;
  }, null);

  return newest === null ? null : new Date(newest).toISOString();
}

function formatLastRefreshed(timestamp: string | null) {
  if (!timestamp) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good Morning, Rodrigo ☀️";
  }

  if (hour < 18) {
    return "Good Afternoon, Rodrigo 👋";
  }

  return "Good Evening, Rodrigo 🌙";
}
