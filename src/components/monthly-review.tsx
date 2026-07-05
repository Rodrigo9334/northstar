"use client";

import { ReceiptText } from "lucide-react";
import { useMemo, useState } from "react";
import { currency } from "@/lib/finance";
import type { ReviewMonth } from "@/lib/dashboard-data";

type MonthlyReviewProps = {
  months: ReviewMonth[];
};

export function MonthlyReview({ months }: MonthlyReviewProps) {
  const [selectedMonthName, setSelectedMonthName] = useState(months[0]?.name ?? "");
  const selectedMonth = useMemo(
    () => months.find((month) => month.name === selectedMonthName) ?? months[0],
    [months, selectedMonthName]
  );
  const [selectedCategoryName, setSelectedCategoryName] = useState(selectedMonth.categories[0]?.name ?? "");
  const selectedCategory =
    selectedMonth.categories.find((category) => category.name === selectedCategoryName) ??
    selectedMonth.categories[0];

  function chooseMonth(monthName: string) {
    const month = months.find((item) => item.name === monthName);
    setSelectedMonthName(monthName);
    setSelectedCategoryName(month?.categories[0]?.name ?? "");
  }

  return (
    <section className="rounded-md border border-white/10 bg-panel/85 p-5">
      <div className="flex items-center gap-2">
        <ReceiptText size={18} className="text-mint" />
        <h2 className="text-base font-semibold text-white">Monthly Review</h2>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {months.map((month) => (
          <button
            className={`min-h-11 rounded-md border px-3 text-sm font-medium transition ${
              selectedMonth.name === month.name
                ? "border-mint bg-mint/15 text-white"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/30"
            }`}
            key={month.name}
            onClick={() => chooseMonth(month.name)}
            type="button"
          >
            {month.name}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-2">
          {selectedMonth.categories.map((category) => (
            <button
              className={`flex min-h-14 w-full items-center justify-between rounded-md border px-4 text-left transition ${
                selectedCategory.name === category.name
                  ? "border-mint bg-mint/15"
                  : "border-white/10 bg-white/[0.03] hover:border-white/30"
              }`}
              key={category.name}
              onClick={() => setSelectedCategoryName(category.name)}
              type="button"
            >
              <span className="font-medium text-white">{category.name}</span>
              <span className="text-sm text-slate-300">{currency(category.total)}</span>
            </button>
          ))}
        </div>

        <div className="rounded-md border border-white/10 bg-ink/70">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="font-semibold text-white">{selectedCategory.name}</p>
            <p className="text-sm text-slate-300">{currency(selectedCategory.total)}</p>
          </div>
          <div className="divide-y divide-white/10">
            {selectedCategory.transactions.length > 0 ? selectedCategory.transactions.map((transaction) => (
              <div className="flex items-center justify-between gap-4 px-4 py-3" key={transaction.id}>
                <div>
                  <p className="font-medium text-white">{transaction.merchant}</p>
                  <p className="mt-1 text-sm text-slate-400">{transaction.date}</p>
                </div>
                <p className="font-semibold text-white">{currency(transaction.amount)}</p>
              </div>
            )) : (
              <div className="px-4 py-5 text-sm text-slate-400">No transactions for this category.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
