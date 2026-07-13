export type FinanceSnapshot = {
  checking: number;
  travelFund: number;
  travelFundGoal: number;
  travelFundYearEndProjection: number;
  vacationFund: number;
  totalCash: number;
  cashGoal: number;
  safetyFloor: number;
  weeklyBudget: number;
  spentToday: number;
  spentThisWeek: number;
  weeklyCategories: WeeklyCategory[];
  weeklyTravelContribution: number;
  weeklyVacationTransfer: number;
  vacationGoal: number;
  knownFirstOfMonthBills: number;
};

export type WeeklyCategory = {
  name: string;
  total: number;
  transactions: Transaction[];
};

export type Transaction = {
  id: string;
  date: string;
  merchant: string;
  amount: number;
};

export type ReviewCategory = {
  name: string;
  total: number;
  transactions: Transaction[];
};

export type ReviewMonth = {
  name: string;
  categories: ReviewCategory[];
};

export type AccountRow = {
  id: string;
  current_balance: number | string | null;
  is_active: boolean | null;
  name: string;
  subtype: string | null;
  type: string;
};

export type TransactionRow = {
  id: string;
  account_id: string;
  amount: number | string;
  category: string | null;
  date: string;
  merchant_name: string | null;
  name: string;
  pending: boolean | null;
};

export type BudgetRow = {
  amount: number | string;
  category: string | null;
  is_active: boolean | null;
  name: string;
  period: string;
  spent_amount: number | string | null;
  starts_on: string;
};

export type GoalRow = {
  current_amount: number | string;
  name: string;
  status: string;
  target_amount: number | string;
  weekly_contribution: number | string | null;
};

const CASH_GOAL_DEFAULT = 30000;
const SAFETY_FLOOR_DEFAULT = 20000;
const TRAVEL_FUND_DEFAULT = 617;
const TRAVEL_FUND_GOAL_DEFAULT = 3000;
const WEEKLY_TRAVEL_CONTRIBUTION_DEFAULT = 50;
const WEEKLY_BUDGET_DEFAULT = 500;
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

function amount(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function includes(value: string, term: string) {
  return value.toLowerCase().includes(term);
}

function startOfWeek(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfWeek(date = new Date()) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 7);
  return next;
}

function weeksUntilYearEnd(date = new Date()) {
  const nextMonday = startOfWeek(date);
  nextMonday.setDate(nextMonday.getDate() + 7);

  const yearEnd = new Date(date.getFullYear() + 1, 0, 1);
  const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;

  return Math.max(0, Math.ceil((yearEnd.getTime() - nextMonday.getTime()) / millisecondsPerWeek));
}

function countsTowardWeeklyBudget(transaction: TransactionRow) {
  if (amount(transaction.amount) <= 0) {
    return false;
  }

  const excludedCategories = [
    "BANK_FEES",
    "TRANSFER_IN",
    "TRANSFER_OUT",
    "LOAN_PAYMENTS",
    "RENT_AND_UTILITIES",
    "INCOME",
    "BILLS_AND_UTILITIES"
  ];
  const description = `${transaction.category ?? ""} ${transaction.merchant_name ?? ""} ${transaction.name}`.toLowerCase();

  if (
    ["bill", "utility", "utilities", "rent", "mortgage", "loan", "insurance", "travel fund"].some((term) =>
      description.includes(term)
    )
  ) {
    return false;
  }

  return !excludedCategories.includes(transaction.category ?? "");
}

function weeklyCategoryName(transaction: TransactionRow) {
  const description = `${transaction.category ?? ""} ${transaction.merchant_name ?? ""} ${transaction.name}`.toLowerCase();

  if (description.includes("coffee") || description.includes("starbucks") || description.includes("dunkin")) {
    return "Coffee";
  }

  if (description.includes("food") || description.includes("restaurant") || description.includes("dining") || description.includes("grocery")) {
    return "Food";
  }

  if (description.includes("gas") || description.includes("fuel") || description.includes("transport")) {
    return "Gas";
  }

  if (description.includes("shop") || description.includes("merchandise") || description.includes("retail")) {
    return "Shopping";
  }

  if (description.includes("entertainment") || description.includes("recreation") || description.includes("movie")) {
    return "Entertainment";
  }

  return "Other";
}

function buildWeeklyCategories(transactions: TransactionRow[]) {
  const categories = new Map<string, Transaction[]>();

  transactions.forEach((transaction) => {
    const name = weeklyCategoryName(transaction);
    const categoryTransactions = categories.get(name) ?? [];

    categories.set(name, [
      ...categoryTransactions,
      {
        id: transaction.id,
        amount: amount(transaction.amount),
        date: new Date(`${transaction.date}T00:00:00`).toLocaleDateString("en-US", {
          day: "2-digit",
          month: "short"
        }),
        merchant: transaction.merchant_name ?? transaction.name
      }
    ]);
  });

  return Array.from(categories.entries())
    .map(([name, categoryTransactions]) => ({
      name,
      total: categoryTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
      transactions: categoryTransactions
    }))
    .sort((left, right) => right.total - left.total);
}

export function buildFinanceSnapshot({
  accounts,
  budgets,
  goals,
  transactions
}: {
  accounts: AccountRow[];
  budgets: BudgetRow[];
  goals: GoalRow[];
  transactions: TransactionRow[];
}): FinanceSnapshot {
  const activeAccounts = accounts.filter((account) => account.is_active !== false);
  const activeAccountIds = new Set(activeAccounts.map((account) => account.id));
  const activeTransactions = transactions.filter((transaction) =>
    activeAccountIds.has(transaction.account_id)
  );

  const checkingAccount =
    activeAccounts.find((account) => account.subtype === "checking") ??
    activeAccounts.find((account) => includes(account.name, "checking"));
  const travelGoal = goals.find(
    (goal) => (includes(goal.name, "travel") || includes(goal.name, "vacation")) && goal.status !== "archived"
  );
  const cashGoal = goals.find((goal) => includes(goal.name, "cash") && goal.status !== "archived");
  const safetyGoal = goals.find((goal) => includes(goal.name, "safety") && goal.status !== "archived");
  const firstOfMonthBills = budgets.find((budget) => {
    const name = budget.name.toLowerCase();
    return budget.is_active !== false && budget.period === "monthly" && name.includes("bill");
  });
  const weekStart = startOfWeek();
  const weekEnd = endOfWeek();
  const weeklyTransactions = activeTransactions.filter((transaction) => {
    const transactionDate = new Date(`${transaction.date}T00:00:00`);

    return transactionDate >= weekStart && transactionDate < weekEnd && countsTowardWeeklyBudget(transaction);
  });
  const today = new Date();
  const spentToday = weeklyTransactions
    .filter((transaction) => {
      const transactionDate = new Date(`${transaction.date}T00:00:00`);

      return (
        transactionDate.getDate() === today.getDate() &&
        transactionDate.getMonth() === today.getMonth() &&
        transactionDate.getFullYear() === today.getFullYear()
      );
    })
    .reduce((sum, transaction) => sum + amount(transaction.amount), 0);
  const spentThisWeek = weeklyTransactions.reduce((sum, transaction) => sum + amount(transaction.amount), 0);
  const travelFund = amount(travelGoal?.current_amount) || TRAVEL_FUND_DEFAULT;
  const weeklyTravelContribution = amount(travelGoal?.weekly_contribution) || WEEKLY_TRAVEL_CONTRIBUTION_DEFAULT;
  const travelFundGoal = amount(travelGoal?.target_amount) || TRAVEL_FUND_GOAL_DEFAULT;
  const travelFundYearEndProjection = travelFund + weeklyTravelContribution * weeksUntilYearEnd();

  const totalCash = activeAccounts
    .filter((account) => account.type === "depository" || account.type === "cash")
    .reduce((sum, account) => sum + amount(account.current_balance), 0);

  return {
    checking: amount(checkingAccount?.current_balance),
    travelFund,
    travelFundGoal,
    travelFundYearEndProjection,
    vacationFund: travelFund,
    totalCash,
    cashGoal: amount(cashGoal?.target_amount) || CASH_GOAL_DEFAULT,
    safetyFloor: amount(safetyGoal?.target_amount) || SAFETY_FLOOR_DEFAULT,
    weeklyBudget: WEEKLY_BUDGET_DEFAULT,
    spentToday,
    spentThisWeek,
    weeklyCategories: buildWeeklyCategories(weeklyTransactions),
    weeklyTravelContribution,
    weeklyVacationTransfer: weeklyTravelContribution,
    vacationGoal: travelFundGoal,
    knownFirstOfMonthBills: amount(firstOfMonthBills?.amount)
  };
}

export function buildMonthlyReview(transactions: TransactionRow[]): ReviewMonth[] {
  return monthNames.map((monthName, monthIndex) => {
    const monthTransactions = transactions.filter((transaction) => {
      const date = new Date(`${transaction.date}T00:00:00`);
      return date.getMonth() === monthIndex && date.getFullYear() === new Date().getFullYear();
    });
    const categories = new Map<string, Transaction[]>();

    monthTransactions.forEach((transaction) => {
      const category = transaction.category ?? "Uncategorized";
      const existing = categories.get(category) ?? [];

      categories.set(category, [
        ...existing,
        {
          id: transaction.id,
          amount: amount(transaction.amount),
          date: new Date(`${transaction.date}T00:00:00`).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short"
          }),
          merchant: transaction.merchant_name ?? transaction.name
        }
      ]);
    });

    const reviewCategories = Array.from(categories.entries()).map(([name, categoryTransactions]) => ({
      name,
      total: categoryTransactions.reduce((sum, transaction) => sum + transaction.amount, 0),
      transactions: categoryTransactions
    }));

    return {
      name: monthName,
      categories:
        reviewCategories.length > 0
          ? reviewCategories
          : [
              {
                name: "No transactions",
                total: 0,
                transactions: []
              }
            ]
    };
  });
}
