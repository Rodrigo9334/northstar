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
      console.error("[plaid/sync-transactions] Plaid is not configured.");
      return NextResponse.json({ error: "Plaid is not configured." }, { status: 500 });
    }

    const authContext = getSupabaseAuthContext(request);

    if (!authContext) {
      console.error("[plaid/sync-transactions] Missing Supabase session.");
      return NextResponse.json({ error: "Missing Supabase session." }, { status: 401 });
    }

    const {
      data: { user },
      error: userError
    } = await authContext.supabase.auth.getUser(authContext.accessToken);

    if (userError || !user) {
      console.error("[plaid/sync-transactions] Invalid Supabase session.", userError);
      return NextResponse.json({ error: "Invalid Supabase session." }, { status: 401 });
    }

    const plaidClient = await getPlaidClient();
    const plaidItems = await loadPlaidItems(authContext.supabase, user.id);

    console.log("[plaid/sync-transactions] Syncing Plaid items.", {
      itemCount: plaidItems.length,
      userId: user.id
    });

    const results = [];

    for (const plaidItem of plaidItems) {
      try {
        const result = await syncPlaidTransactions({
          accessToken: plaidItem.access_token,
          cursor: plaidItem.transactions_cursor ?? null,
          plaidClient,
          plaidItemId: plaidItem.id,
          supabase: authContext.supabase,
          userId: user.id
        });

        results.push({ plaid_item_id: plaidItem.id, ...result });
      } catch (error) {
        const safeError = getSafeTransactionSyncError(error);

        console.error("[plaid/sync-transactions] Item sync failed.", {
          ...safeError,
          plaidItemId: plaidItem.id,
          userId: user.id
        });
        results.push({ plaid_item_id: plaidItem.id, ...safeError });
      }
    }

    return NextResponse.json({ item_count: plaidItems.length, results });
  } catch (error) {
    const safeError = getSafeTransactionSyncError(error);

    console.error("[plaid/sync-transactions] Unexpected error.", safeError);
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
    console.error("[plaid/sync-transactions] Could not load Plaid items.", {
      message: withCursor.error.message,
      userId
    });
    throw new Error(withCursor.error.message);
  }

  console.log("[plaid/sync-transactions] Cursor column is not available while loading items.", { userId });

  const withoutCursor = await supabase
    .from("plaid_items")
    .select("id,access_token")
    .eq("user_id", userId)
    .eq("status", "active");

  if (withoutCursor.error) {
    console.error("[plaid/sync-transactions] Could not load Plaid items without cursor.", {
      message: withoutCursor.error.message,
      userId
    });
    throw new Error(withoutCursor.error.message);
  }

  return (withoutCursor.data ?? []) as PlaidItemRow[];
}
