export type FinanceSnapshot = {
  checking: number;
  vacationFund: number;
  totalCash: number;
  cashGoal: number;
  safetyFloor: number;
  weeklyBudget: number;
  spentThisWeek: number;
  weeklyVacationTransfer: number;
  vacationGoal: number;
  knownFirstOfMonthBills: number;
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
  current_balance: number | string | null;
  is_active: boolean | null;
  name: string;
  subtype: string | null;
  type: string;
};

export type TransactionRow = {
  id: string;
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

function isOutflow(transaction: TransactionRow) {
  return amount(transaction.amount) > 0;
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
  const checkingAccount =
    activeAccounts.find((account) => account.subtype === "checking") ??
    activeAccounts.find((account) => includes(account.name, "checking"));
  const vacationGoal = goals.find((goal) => includes(goal.name, "vacation") && goal.status !== "archived");
  const cashGoal = goals.find((goal) => includes(goal.name, "cash") && goal.status !== "archived");
  const safetyGoal = goals.find((goal) => includes(goal.name, "safety") && goal.status !== "archived");
  const weeklyBudget = budgets.find((budget) => budget.is_active !== false && budget.period === "weekly");
  const firstOfMonthBills = budgets.find((budget) => {
    const name = budget.name.toLowerCase();
    return budget.is_active !== false && budget.period === "monthly" && name.includes("bill");
  });
  const weekStart = startOfWeek();
  const weekEnd = endOfWeek();
  const spentThisWeek = transactions
    .filter((transaction) => {
      const transactionDate = new Date(`${transaction.date}T00:00:00`);
      return transactionDate >= weekStart && transactionDate < weekEnd && isOutflow(transaction);
    })
    .reduce((sum, transaction) => sum + amount(transaction.amount), 0);

  const totalCash = activeAccounts
    .filter((account) => account.type === "depository" || account.type === "cash")
    .reduce((sum, account) => sum + amount(account.current_balance), 0);

  return {
    checking: amount(checkingAccount?.current_balance),
    vacationFund: amount(vacationGoal?.current_amount),
    totalCash,
    cashGoal: amount(cashGoal?.target_amount) || CASH_GOAL_DEFAULT,
    safetyFloor: amount(safetyGoal?.target_amount) || SAFETY_FLOOR_DEFAULT,
    weeklyBudget: amount(weeklyBudget?.amount) || WEEKLY_BUDGET_DEFAULT,
    spentThisWeek: spentThisWeek || amount(weeklyBudget?.spent_amount),
    weeklyVacationTransfer: amount(vacationGoal?.weekly_contribution),
    vacationGoal: amount(vacationGoal?.target_amount),
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
