export type BudgetStatus = "Green" | "Yellow" | "Red";

export type PurchaseAdvice = {
  allowed: boolean;
  checkingAfterPurchase: number;
  message: string;
};

export function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

export function percentOfGoal(value: number, goal: number) {
  if (goal <= 0) {
    return 0;
  }

  return (value / goal) * 100;
}

export function getWeeklyBudgetStatus(spent: number, budget: number): BudgetStatus {
  const spendRatio = spent / budget;

  if (spendRatio < 0.7) {
    return "Green";
  }

  if (spendRatio <= 1) {
    return "Yellow";
  }

  return "Red";
}

export function getBudgetStatusTone(status: BudgetStatus) {
  const tones: Record<BudgetStatus, string> = {
    Green: "bg-mint/15 text-mint",
    Yellow: "bg-gold/15 text-gold",
    Red: "bg-rose/15 text-rose"
  };

  return tones[status];
}

export function getPurchaseAdvice(amount: number, checking: number, safetyFloor: number): PurchaseAdvice {
  const checkingAfterPurchase = checking - amount;
  const allowed = checkingAfterPurchase >= safetyFloor;

  return {
    allowed,
    checkingAfterPurchase,
    message: allowed
      ? "This keeps checking above the safety floor."
      : "This drops checking below the safety floor."
  };
}
