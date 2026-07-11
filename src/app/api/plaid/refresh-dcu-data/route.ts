import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlaidClient, isPlaidServerConfigured } from "@/lib/plaid/client";
import { getSafeTransactionSyncError, syncPlaidTransactions } from "@/lib/plaid/transactions";
import { getSupabaseAuthContext } from "@/lib/supabase/server";

type PlaidItemRow = {
  access_token: string;
  id: string;
  transactions_cursor?: string | null;
};

export async function POST(request: Request) {
  try {
    if (!isPlaidServerConfigured()) {
      console.error("[plaid/refresh-dcu-data] Plaid is not configured.");
      return NextResponse.json({ error: "Plaid is not configured." }, { status: 500 });
    }

    const authContext = getSupabaseAuthContext(request);

    if (!authContext) {
      console.error("[plaid/refresh-dcu-data] Missing Supabase session.");
      return NextResponse.json({ error: "Missing Supabase session." }, { status: 401 });
    }

    const {
      data: { user },
      error: userError
    } = await authContext.supabase.auth.getUser(authContext.accessToken);

    if (userError || !user) {
      console.error("[plaid/refresh-dcu-data] Invalid Supabase session.", userError);
      return NextResponse.json({ error: "Invalid Supabase session." }, { status: 401 });
    }

    const plaidClient = await getPlaidClient();
    const plaidItems = await loadPlaidItems(authContext.supabase, user.id);
    const results = [];
    const refreshedAt = new Date().toISOString();
    let failedItems = 0;

    console.log("[plaid/refresh-dcu-data] Refreshing Plaid data.", {
      itemCount: plaidItems.length,
      userId: user.id
    });

    for (const plaidItem of plaidItems) {
      try {
        const balances = await plaidClient.accountsBalanceGet({
          access_token: plaidItem.access_token
        });
        const balanceUpdate = await updateAccountBalances({
          accounts: balances.data.accounts,
          plaidItemId: plaidItem.id,
          supabase: authContext.supabase,
          userId: user.id
        });
        const transactionSync = await syncPlaidTransactions({
          accessToken: plaidItem.access_token,
          cursor: plaidItem.transactions_cursor ?? null,
          plaidClient,
          plaidItemId: plaidItem.id,
          supabase: authContext.supabase,
          userId: user.id
        });

        results.push({
          accounts_updated: balanceUpdate.accountsUpdated,
          plaid_item_id: plaidItem.id,
          transaction_sync: transactionSync
        });
      } catch (error) {
        const safeError = getSafeTransactionSyncError(error);
        failedItems += 1;

        console.error("[plaid/refresh-dcu-data] Item refresh failed.", {
          ...safeError,
          plaidItemId: plaidItem.id,
          userId: user.id
        });
        results.push({ plaid_item_id: plaidItem.id, ...safeError });
      }
    }

    const responseBody = {
      item_count: plaidItems.length,
      refreshed_at: refreshedAt,
      results
    };

    if (failedItems > 0) {
      return NextResponse.json(
        {
          ...responseBody,
          error: "Could not refresh DCU data."
        },
        { status: 502 }
      );
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    const safeError = getSafeTransactionSyncError(error);

    console.error("[plaid/refresh-dcu-data] Unexpected error.", safeError);
    return NextResponse.json(safeError, { status: 500 });
  }
}

async function loadPlaidItems(supabase: SupabaseClient, userId: string) {
  const withCursor = await supabase
    .from("plaid_items")
    .select("id,access_token,transactions_cursor")
    .eq("user_id", userId)
    .eq("status", "active");

  if (!withCursor.error) {
    return (withCursor.data ?? []) as PlaidItemRow[];
  }

  if (!withCursor.error.message.includes("transactions_cursor") && !withCursor.error.message.includes("schema cache")) {
    console.error("[plaid/refresh-dcu-data] Could not load Plaid items.", {
      message: withCursor.error.message,
      userId
    });
    throw new Error(withCursor.error.message);
  }

  console.log("[plaid/refresh-dcu-data] Cursor column is not available while loading items.", { userId });

  const withoutCursor = await supabase
    .from("plaid_items")
    .select("id,access_token")
    .eq("user_id", userId)
    .eq("status", "active");

  if (withoutCursor.error) {
    console.error("[plaid/refresh-dcu-data] Could not load Plaid items without cursor.", {
      message: withoutCursor.error.message,
      userId
    });
    throw new Error(withoutCursor.error.message);
  }

  return (withoutCursor.data ?? []) as PlaidItemRow[];
}

async function updateAccountBalances({
  accounts,
  plaidItemId,
  supabase,
  userId
}: {
  accounts: Array<{
    account_id: string;
    balances: {
      available: number | null;
      current: number | null;
    };
  }>;
  plaidItemId: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  let accountsUpdated = 0;

  for (const account of accounts) {
    const { error } = await supabase
      .from("accounts")
      .update({
        available_balance: account.balances.available,
        current_balance: account.balances.current ?? 0
      })
      .eq("user_id", userId)
      .eq("plaid_item_id", plaidItemId)
      .eq("plaid_account_id", account.account_id);

    if (error) {
      console.error("[plaid/refresh-dcu-data] Could not update account balance.", {
        message: error.message,
        plaidAccountId: account.account_id,
        plaidItemId,
        userId
      });
      throw new Error(error.message);
    }

    accountsUpdated += 1;
  }

  return { accountsUpdated };
}
