import type { SupabaseClient } from "@supabase/supabase-js";
import type { Transaction } from "plaid";
import type { getPlaidClient } from "@/lib/plaid/client";

type PlaidClient = Awaited<ReturnType<typeof getPlaidClient>>;

type SyncPlaidTransactionsOptions = {
  accessToken: string;
  cursor?: string | null;
  plaidItemId: string;
  plaidClient: PlaidClient;
  supabase: SupabaseClient;
  userId: string;
};

type PlaidAccountRow = {
  id: string;
  plaid_account_id: string;
};

export type TransactionSyncResult = {
  added: number;
  cursorPersisted: boolean;
  deleted: number;
  hasMore: boolean;
  modified: number;
  nextCursor: string | null;
  pages: number;
  skipped: number;
};

export async function syncPlaidTransactions({
  accessToken,
  cursor,
  plaidItemId,
  plaidClient,
  supabase,
  userId
}: SyncPlaidTransactionsOptions): Promise<TransactionSyncResult> {
  console.log("[plaid/transactions-sync] Starting sync.", {
    hasCursor: Boolean(cursor),
    plaidItemId,
    userId
  });

  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id,plaid_account_id")
    .eq("user_id", userId)
    .eq("plaid_item_id", plaidItemId);

  if (accountsError) {
    console.error("[plaid/transactions-sync] Could not load account mapping.", {
      message: accountsError.message,
      plaidItemId,
      userId
    });
    throw new Error(accountsError.message);
  }

  const accountIdByPlaidId = new Map(
    ((accounts ?? []) as PlaidAccountRow[]).map((account) => [account.plaid_account_id, account.id])
  );
  let nextCursor = cursor ?? undefined;
  let hasMore = true;
  let pages = 0;
  let added = 0;
  let modified = 0;
  let deleted = 0;
  let skipped = 0;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      count: 500,
      cursor: nextCursor,
      options: {
        include_original_description: true
      }
    });
    const page = response.data;
    const upsertTransactions = [...page.added, ...page.modified];
    const rows = upsertTransactions
      .map((transaction) => toTransactionRow(transaction, accountIdByPlaidId, userId))
      .filter((row): row is NonNullable<typeof row> => {
        if (!row) {
          skipped += 1;
          return false;
        }

        return true;
      });

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("transactions")
        .upsert(rows, { onConflict: "user_id,plaid_transaction_id" });

      if (upsertError) {
        console.error("[plaid/transactions-sync] Could not upsert transactions.", {
          message: upsertError.message,
          plaidItemId,
          rowCount: rows.length,
          userId
        });
        throw new Error(upsertError.message);
      }
    }

    const removedIds = page.removed.map((transaction) => transaction.transaction_id);

    if (removedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", userId)
        .in("plaid_transaction_id", removedIds);

      if (deleteError) {
        console.error("[plaid/transactions-sync] Could not delete removed transactions.", {
          message: deleteError.message,
          plaidItemId,
          removedCount: removedIds.length,
          userId
        });
        throw new Error(deleteError.message);
      }
    }

    pages += 1;
    added += page.added.length;
    modified += page.modified.length;
    deleted += page.removed.length;
    nextCursor = page.next_cursor;
    hasMore = page.has_more;

    console.log("[plaid/transactions-sync] Synced page.", {
      added: page.added.length,
      hasMore,
      modified: page.modified.length,
      page: pages,
      plaidItemId,
      removed: page.removed.length,
      requestId: page.request_id,
      skipped,
      updateStatus: page.transactions_update_status,
      userId
    });
  }

  const cursorPersisted = await persistCursor({
    nextCursor: nextCursor ?? null,
    plaidItemId,
    supabase,
    userId
  });

  console.log("[plaid/transactions-sync] Finished sync.", {
    added,
    cursorPersisted,
    deleted,
    modified,
    pages,
    plaidItemId,
    skipped,
    userId
  });

  return {
    added,
    cursorPersisted,
    deleted,
    hasMore,
    modified,
    nextCursor: nextCursor ?? null,
    pages,
    skipped
  };
}

export function getSafeTransactionSyncError(error: unknown) {
  if (isRecord(error)) {
    const response = isRecord(error.response) ? error.response : null;
    const data = response && isRecord(response.data) ? response.data : null;

    if (data) {
      return {
        code: getString(data.error_code),
        error: getString(data.error_message) ?? getString(data.display_message) ?? "Plaid transaction sync failed.",
        plaid_error_type: getString(data.error_type),
        plaid_request_id: getString(data.request_id)
      };
    }
  }

  if (error instanceof Error) {
    return { error: error.message };
  }

  return { error: "Plaid transaction sync failed." };
}

function toTransactionRow(
  transaction: Transaction,
  accountIdByPlaidId: Map<string, string>,
  userId: string
) {
  const accountId = accountIdByPlaidId.get(transaction.account_id);

  if (!accountId) {
    console.error("[plaid/transactions-sync] Skipping transaction without account mapping.", {
      plaidAccountId: transaction.account_id,
      plaidTransactionId: transaction.transaction_id,
      userId
    });
    return null;
  }

  return {
    account_id: accountId,
    amount: transaction.amount,
    category: transaction.personal_finance_category?.primary ?? transaction.category?.[0] ?? null,
    date: transaction.date,
    merchant_name: transaction.merchant_name ?? null,
    name: transaction.name,
    pending: transaction.pending,
    plaid_transaction_id: transaction.transaction_id,
    user_id: userId
  };
}

async function persistCursor({
  nextCursor,
  plaidItemId,
  supabase,
  userId
}: {
  nextCursor: string | null;
  plaidItemId: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const syncedAt = new Date().toISOString();
  const { error: cursorError } = await supabase
    .from("plaid_items")
    .update({
      last_synced_at: syncedAt,
      transactions_cursor: nextCursor
    })
    .eq("id", plaidItemId)
    .eq("user_id", userId);

  if (!cursorError) {
    return true;
  }

  if (!isMissingColumnError(cursorError.message)) {
    console.error("[plaid/transactions-sync] Could not persist cursor.", {
      message: cursorError.message,
      plaidItemId,
      userId
    });
    throw new Error(cursorError.message);
  }

  console.log("[plaid/transactions-sync] Cursor column is not available; updating last_synced_at only.", {
    plaidItemId,
    userId
  });

  const { error: syncedAtError } = await supabase
    .from("plaid_items")
    .update({ last_synced_at: syncedAt })
    .eq("id", plaidItemId)
    .eq("user_id", userId);

  if (syncedAtError) {
    console.error("[plaid/transactions-sync] Could not update last_synced_at.", {
      message: syncedAtError.message,
      plaidItemId,
      userId
    });
    throw new Error(syncedAtError.message);
  }

  return false;
}

function isMissingColumnError(message: string) {
  return message.includes("transactions_cursor") || message.includes("schema cache");
}

function getString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
