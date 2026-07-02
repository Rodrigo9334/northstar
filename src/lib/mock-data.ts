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

export const financeSnapshot: FinanceSnapshot = {
  checking: 23641,
  vacationFund: 567,
  totalCash: 24208,
  cashGoal: 30000,
  safetyFloor: 20000,
  weeklyBudget: 500,
  spentThisWeek: 218,
  weeklyVacationTransfer: 50,
  vacationGoal: 3000,
  knownFirstOfMonthBills: 4735
};

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

const categoryTemplates = [
  {
    name: "Dining",
    merchants: ["Harbor Coffee", "North End Pizza", "Market Bowl"]
  },
  {
    name: "Groceries",
    merchants: ["Fresh Mart", "Whole Pantry", "City Produce"]
  },
  {
    name: "Transit",
    merchants: ["Metro Pass", "RideShare", "Fuel Stop"]
  },
  {
    name: "Home",
    merchants: ["Power Utility", "Internet Service", "Hardware Corner"]
  }
];

export const monthlyReview: ReviewMonth[] = monthNames.map((name, monthIndex) => ({
  name,
  categories: categoryTemplates.map((category, categoryIndex) => {
    const transactions = category.merchants.map((merchant, transactionIndex) => {
      const amount = 26 + monthIndex * 3 + categoryIndex * 41 + transactionIndex * 17;

      return {
        id: `${name}-${category.name}-${transactionIndex}`,
        date: `${name.slice(0, 3)} ${String(3 + transactionIndex * 8).padStart(2, "0")}`,
        merchant,
        amount
      };
    });

    return {
      name: category.name,
      total: transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
      transactions
    };
  })
}));
