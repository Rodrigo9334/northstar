import { NextResponse } from "next/server";
import { getSupabaseAuthContext } from "@/lib/supabase/server";

type WeeklyBudgetBody = {
  amount?: number;
};

export async function POST(request: Request) {
  try {
    const authContext = getSupabaseAuthContext(request);

    if (!authContext) {
      console.error("[budgets/weekly] Missing Supabase session.");
      return NextResponse.json({ error: "Missing Supabase session." }, { status: 401 });
    }

    const {
      data: { user },
      error: userError
    } = await authContext.supabase.auth.getUser(authContext.accessToken);

    if (userError || !user) {
      console.error("[budgets/weekly] Invalid Supabase session.", getSafeSupabaseError(userError));
      return NextResponse.json({ error: "Invalid Supabase session." }, { status: 401 });
    }

    const body = await readJsonBody(request);
    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      console.error("[budgets/weekly] Invalid amount.", { amount: body.amount, userId: user.id });
      return NextResponse.json({ error: "Enter a weekly budget greater than $0." }, { status: 400 });
    }

    const startsOn = formatDate(startOfWeek());
    const budgetPayload = {
      amount,
      is_active: true,
      name: "Weekly Budget",
      period: "weekly",
      starts_on: startsOn,
      user_id: user.id
    };

    console.log("[budgets/weekly] Saving weekly budget.", {
      amount,
      period: budgetPayload.period,
      startsOn,
      userId: user.id
    });

    const existingBudget = await authContext.supabase
      .from("budgets")
      .select("id")
      .eq("user_id", user.id)
      .eq("period", "weekly")
      .eq("starts_on", startsOn)
      .limit(1)
      .maybeSingle();

    if (existingBudget.error) {
      console.error("[budgets/weekly] Lookup failed.", getSafeSupabaseError(existingBudget.error));
      return NextResponse.json({ error: "Could not save weekly budget." }, { status: 500 });
    }

    if (existingBudget.data?.id) {
      const { error } = await authContext.supabase
        .from("budgets")
        .update(budgetPayload)
        .eq("id", existingBudget.data.id)
        .eq("user_id", user.id);

      if (error) {
        console.error("[budgets/weekly] Update failed.", getSafeSupabaseError(error));
        return NextResponse.json({ error: "Could not save weekly budget." }, { status: 500 });
      }

      console.log("[budgets/weekly] Updated weekly budget.", {
        budgetId: existingBudget.data.id,
        startsOn,
        userId: user.id
      });
      return NextResponse.json({ budget_id: existingBudget.data.id, starts_on: startsOn });
    }

    const { data, error } = await authContext.supabase
      .from("budgets")
      .insert(budgetPayload)
      .select("id")
      .single();

    if (error) {
      console.error("[budgets/weekly] Insert failed.", getSafeSupabaseError(error));
      return NextResponse.json({ error: "Could not save weekly budget." }, { status: 500 });
    }

    console.log("[budgets/weekly] Inserted weekly budget.", {
      budgetId: data?.id,
      startsOn,
      userId: user.id
    });
    return NextResponse.json({ budget_id: data?.id, starts_on: startsOn });
  } catch (error) {
    console.error("[budgets/weekly] Unexpected error.", getSafeSupabaseError(error));
    return NextResponse.json({ error: "Could not save weekly budget." }, { status: 500 });
  }
}

async function readJsonBody(request: Request): Promise<WeeklyBudgetBody> {
  try {
    return (await request.json()) as WeeklyBudgetBody;
  } catch {
    return {};
  }
}

function startOfWeek(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);

  return next;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
