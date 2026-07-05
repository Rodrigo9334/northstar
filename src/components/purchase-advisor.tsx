"use client";

import { Calculator, CheckCircle2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import type { FinanceSnapshot } from "@/lib/dashboard-data";
import { currency, getPurchaseAdvice, type PurchaseAdvice } from "@/lib/finance";

type PurchaseAdvisorProps = {
  snapshot: FinanceSnapshot;
  defaultAdvice: PurchaseAdvice;
};

export function PurchaseAdvisor({ snapshot, defaultAdvice }: PurchaseAdvisorProps) {
  const [amount, setAmount] = useState("420");
  const numericAmount = Number(amount);
  const advice = useMemo(() => {
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      return defaultAdvice;
    }

    return getPurchaseAdvice(numericAmount, snapshot.checking, snapshot.safetyFloor);
  }, [defaultAdvice, numericAmount, snapshot.checking, snapshot.safetyFloor]);

  const Icon = advice.allowed ? CheckCircle2 : XCircle;

  return (
    <section className="rounded-md border border-white/10 bg-panel/85 p-5">
      <div className="flex items-center gap-2">
        <Calculator size={18} className="text-mint" />
        <h2 className="text-base font-semibold text-white">Purchase Advisor</h2>
      </div>

      <label className="mt-5 block text-sm font-medium text-slate-300" htmlFor="purchase-amount">
        Purchase amount
      </label>
      <div className="mt-2 flex min-h-14 items-center rounded-md border border-white/10 bg-ink px-4">
        <span className="text-xl text-slate-400">$</span>
        <input
          id="purchase-amount"
          className="min-w-0 flex-1 bg-transparent px-2 text-3xl font-semibold text-white outline-none"
          inputMode="decimal"
          min="0"
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>

      <div className={`mt-5 rounded-md border p-4 ${advice.allowed ? "border-mint/25 bg-mint/10" : "border-rose/30 bg-rose/10"}`}>
        <div className="flex items-start gap-3">
          <Icon className={advice.allowed ? "mt-1 text-mint" : "mt-1 text-rose"} size={22} />
          <div>
            <p className="text-lg font-semibold text-white">{advice.message}</p>
            <p className="mt-1 text-sm text-slate-300">
              Checking after purchase: {currency(advice.checkingAfterPurchase)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
