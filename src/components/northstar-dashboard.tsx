"use client";

import {
  Banknote,
  CalendarDays,
  Check,
  Compass,
  CreditCard,
  Landmark,
  Pencil,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Target,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/auth-panel";
import { DashboardMetric } from "@/components/dashboard-metric";
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
  vacationFund: 0,
  totalCash: 0,
  cashGoal: 30000,
  safetyFloor: 20000,
  weeklyBudget: 0,
  spentThisWeek: 0,
  weeklyVacationTransfer: 0,
  vacationGoal: 0,
  knownFirstOfMonthBills: 0
};

const navigation = [
  { href: "#today", label: "Today", icon: Compass },
  { href: "#weekly-budget", label: "Weekly", icon: CalendarDays },
  { href: "#goals", label: "Goals", icon: Target },
  { href: "#monthly-review", label: "Review", icon: ReceiptText },
  { href: "#purchase-advisor", label: "Advisor", icon: CreditCard }
];

type DashboardState = {
  accountCount: number;
  error: string;
  hasFinancialData: boolean;
  isLoading: boolean;
  monthlyReview: ReviewMonth[];
  snapshot: FinanceSnapshot;
  transactionCount: number;
};

export function NorthStarDashboard() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isConnectingBank, setIsConnectingBank] = useState(false);
  const [isEditingWeeklyBudget, setIsEditingWeeklyBudget] = useState(false);
  const [isSavingWeeklyBudget, setIsSavingWeeklyBudget] = useState(false);
  const [plaidError, setPlaidError] = useState("");
  const [weeklyBudgetError, setWeeklyBudgetError] = useState("");
  const [weeklyBudgetInput, setWeeklyBudgetInput] = useState("");
  const [hasAttemptedTransactionSync, setHasAttemptedTransactionSync] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardState>({
    accountCount: 0,
    error: "",
    hasFinancialData: false,
    isLoading: true,
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
  const safeToSpend = Math.max(0, snapshot.checking - snapshot.safetyFloor - snapshot.knownFirstOfMonthBills);
  const weeklyStatus = getWeeklyBudgetStatus(snapshot.spentThisWeek, snapshot.weeklyBudget || 1);
  const vacationProgress = percentOfGoal(snapshot.vacationFund, snapshot.vacationGoal);
  const cashGoalProgress = percentOfGoal(snapshot.totalCash, snapshot.cashGoal);
  const weeklySpendProgress = percentOfGoal(snapshot.spentThisWeek, snapshot.weeklyBudget);
  const defaultAdvice = getPurchaseAdvice(420, snapshot.checking, snapshot.safetyFloor);
  const showRealDashboard = !dashboard.isLoading && !dashboard.error && dashboard.hasFinancialData;
  const showEmptyState = !dashboard.isLoading && !dashboard.error && !dashboard.hasFinancialData;

  function startEditingWeeklyBudget() {
    setWeeklyBudgetInput(String(Math.round(snapshot.weeklyBudget)));
    setWeeklyBudgetError("");
    setIsEditingWeeklyBudget(true);
  }

  function cancelEditingWeeklyBudget() {
    setWeeklyBudgetInput("");
    setWeeklyBudgetError("");
    setIsEditingWeeklyBudget(false);
  }

  async function saveWeeklyBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session || !supabase) {
      return;
    }

    const nextAmount = Number(weeklyBudgetInput);

    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setWeeklyBudgetError("Enter a weekly budget greater than $0.");
      return;
    }

    setIsSavingWeeklyBudget(true);
    setWeeklyBudgetError("");

    try {
      await saveCurrentWeekBudget(supabase, session, nextAmount);
      await loadDashboardData(supabase, setDashboard);
      setIsEditingWeeklyBudget(false);
    } catch (error) {
      console.error("[dashboard] Could not save weekly budget.", getSafeSupabaseError(error));
      setWeeklyBudgetError("Could not save weekly budget. Please try again.");
    } finally {
      setIsSavingWeeklyBudget(false);
    }
  }

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
                  <p className="text-xs text-slate-400">Today</p>
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
              <section id="today" className="scroll-mt-24 overflow-hidden rounded-md border border-white/10 bg-panel/90 shadow-glow">
                <div className="border-b border-white/10 px-5 py-5 sm:px-6 lg:px-7">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-medium uppercase tracking-[0.24em] text-mint">Today</p>
                      <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl">
                        Cash clarity for the week ahead
                      </h1>
                    </div>
                    <div className="min-w-52 rounded-md border border-white/10 bg-white/[0.04] px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Known bills</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{currency(snapshot.knownFirstOfMonthBills)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
                  <DashboardMetric
                    icon={Banknote}
                    label="Total Cash"
                    value={currency(snapshot.totalCash)}
                    helper={`${Math.round(cashGoalProgress)}% of ${currency(snapshot.cashGoal)} goal`}
                  />
                  <DashboardMetric
                    icon={Landmark}
                    label="Checking"
                    value={currency(snapshot.checking)}
                    helper={`${currency(snapshot.safetyFloor)} floor`}
                  />
                  <DashboardMetric
                    icon={PiggyBank}
                    label="Vacation Fund"
                    value={currency(snapshot.vacationFund)}
                    helper={`${currency(snapshot.weeklyVacationTransfer)} weekly transfer`}
                  />
                  <DashboardMetric
                    icon={ShieldCheck}
                    label="Safe To Spend"
                    value={currency(safeToSpend)}
                    helper="After floor and known bills"
                    tone="mint"
                  />
                </div>
              </section>

              <section id="weekly-budget" className="scroll-mt-24 rounded-md border border-white/10 bg-panel/90 p-5 shadow-glow sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-mint/15 text-mint">
                      <CalendarDays size={18} />
                    </span>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Section</p>
                      <h2 className="text-xl font-semibold text-white">Weekly Budget</h2>
                    </div>
                  </div>
                  <StatusPill status={weeklyStatus} />
                </div>

                <div className="mt-6 grid grid-cols-3 gap-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Budget</p>
                      {!isEditingWeeklyBudget ? (
                        <button
                          aria-label="Edit weekly budget"
                          className="rounded-md p-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-mint"
                          onClick={startEditingWeeklyBudget}
                          type="button"
                        >
                          <Pencil size={13} />
                        </button>
                      ) : null}
                    </div>
                    {isEditingWeeklyBudget ? (
                      <form className="mt-2" onSubmit={saveWeeklyBudget}>
                        <div className="flex min-w-0 items-center gap-2">
                          <input
                            className="min-h-10 w-full min-w-0 rounded-md border border-white/10 bg-ink/80 px-3 text-2xl font-semibold text-white outline-none transition focus:border-mint/70 sm:text-3xl"
                            inputMode="decimal"
                            min="1"
                            onChange={(event) => setWeeklyBudgetInput(event.target.value)}
                            step="1"
                            type="number"
                            value={weeklyBudgetInput}
                          />
                          <button
                            aria-label="Save weekly budget"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-mint text-ink transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isSavingWeeklyBudget}
                            type="submit"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            aria-label="Cancel weekly budget edit"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isSavingWeeklyBudget}
                            onClick={cancelEditingWeeklyBudget}
                            type="button"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        {weeklyBudgetError ? <p className="mt-2 text-xs text-red-300">{weeklyBudgetError}</p> : null}
                      </form>
                    ) : (
                      <p className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{currency(snapshot.weeklyBudget)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Spent</p>
                    <p className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{currency(snapshot.spentThisWeek)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Left</p>
                    <p className="mt-2 text-2xl font-semibold text-mint sm:text-3xl">{currency(weeklyRemaining)}</p>
                  </div>
                </div>
                <ProgressBar label="Weekly spend used" value={weeklySpendProgress} />
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
                    <p className="mt-2 text-sm text-slate-400">Target cash reserve: {currency(snapshot.cashGoal)}</p>
                  </div>
                  <ProgressBar label="$30,000 cash goal" value={cashGoalProgress} />
                  <ProgressBar label="$20,000 safety floor" value={percentOfGoal(snapshot.checking, snapshot.safetyFloor)} />
                </div>

                <div className="rounded-md border border-white/10 bg-panel/90 p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-mint/15 text-mint">
                      <PiggyBank size={18} />
                    </span>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Goal</p>
                      <h3 className="text-xl font-semibold text-white">Vacation Fund</h3>
                    </div>
                  </div>
                  <p className="mt-6 text-4xl font-semibold text-white">{currency(snapshot.vacationFund)}</p>
                  <div className="mt-5 grid grid-cols-2 gap-4 border-y border-white/10 py-4 text-sm">
                    <div>
                      <p className="text-slate-500">Weekly transfer</p>
                      <p className="mt-1 text-xl font-semibold text-white">{currency(snapshot.weeklyVacationTransfer)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Goal</p>
                      <p className="mt-1 text-xl font-semibold text-white">{currency(snapshot.vacationGoal)}</p>
                    </div>
                  </div>
                  <ProgressBar label="Vacation progress" value={vacationProgress} />
                </div>
              </section>

              <div id="monthly-review" className="scroll-mt-24">
                <MonthlyReview months={dashboard.monthlyReview} />
              </div>

              <div id="purchase-advisor" className="scroll-mt-24">
                <PurchaseAdvisor snapshot={snapshot} defaultAdvice={defaultAdvice} />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-30 rounded-md border border-white/10 bg-ink/95 px-2 py-2 shadow-glow backdrop-blur lg:hidden" aria-label="Mobile navigation">
        <div className="grid grid-cols-5 gap-1">
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

  const [accountsResult, transactionsResult, budgetsResult, goalsResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("current_balance,is_active,name,subtype,type")
      .order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select("id,amount,category,date,merchant_name,name,pending")
      .order("date", { ascending: false })
      .limit(500),
    supabase
      .from("budgets")
      .select("amount,category,is_active,name,period,spent_amount,starts_on")
      .order("starts_on", { ascending: false }),
    supabase
      .from("goals")
      .select("current_amount,name,status,target_amount,weekly_contribution")
      .order("created_at", { ascending: true })
  ]);

  const error =
    accountsResult.error?.message ??
    transactionsResult.error?.message ??
    budgetsResult.error?.message ??
    goalsResult.error?.message ??
    "";

  const accounts = (accountsResult.data ?? []) as AccountRow[];
  const transactions = (transactionsResult.data ?? []) as TransactionRow[];
  const budgets = (budgetsResult.data ?? []) as BudgetRow[];
  const goals = (goalsResult.data ?? []) as GoalRow[];
  const hasFinancialData = accounts.length > 0 || transactions.length > 0 || budgets.length > 0 || goals.length > 0;

  setDashboard({
    accountCount: accounts.length,
    error,
    hasFinancialData,
    isLoading: false,
    monthlyReview: buildMonthlyReview(transactions),
    snapshot: hasFinancialData ? buildFinanceSnapshot({ accounts, budgets, goals, transactions }) : emptySnapshot,
    transactionCount: transactions.length
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

async function saveCurrentWeekBudget(supabase: SupabaseClient, session: Session, amount: number) {
  const accessToken = await getSupabaseAccessToken(supabase, session);
  const response = await fetch("/api/budgets/weekly", {
    body: JSON.stringify({ amount }),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(data.error ?? `Could not save weekly budget. (${response.status})`);
  }
}

function getSafeSupabaseError(error: unknown) {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;

    return {
      code: typeof record.code === "string" ? record.code : undefined,
      details: typeof record.details === "string" ? record.details : undefined,
      hint: typeof record.hint === "string" ? record.hint : undefined,
      message: typeof record.message === "string" ? record.message : "Unknown Supabase error"
    };
  }

  return { message: error instanceof Error ? error.message : "Unknown Supabase error" };
}
