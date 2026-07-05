import { NextResponse } from "next/server";
import { getPlaidClient, plaidCountryCodes, isPlaidServerConfigured } from "@/lib/plaid/client";
import { getSafeTransactionSyncError, syncPlaidTransactions } from "@/lib/plaid/transactions";
import { getSupabaseAuthContext } from "@/lib/supabase/server";

type ExchangeBody = {
  public_token?: string;
};

export async function POST(request: Request) {
  try {
    if (!isPlaidServerConfigured()) {
      console.error("[plaid/exchange-public-token] Plaid is not configured.");
      return plaidJsonError("Plaid is not configured.", 500);
    }

    const plaidClient = await getPlaidClient();
    const authContext = getSupabaseAuthContext(request);

    if (!authContext) {
      console.error("[plaid/exchange-public-token] Missing Supabase session.");
      return plaidJsonError("Missing Supabase session.", 401);
    }

    const {
      data: { user },
      error: userError
    } = await authContext.supabase.auth.getUser(authContext.accessToken);

    if (userError || !user) {
      console.error("[plaid/exchange-public-token] Invalid Supabase session.", userError);
      return plaidJsonError("Invalid Supabase session.", 401);
    }

    console.log("[plaid/exchange-public-token] Supabase user identified.", { userId: user.id });

    const body = await readJsonBody(request);

    if (!body.public_token) {
      console.error("[plaid/exchange-public-token] Missing public token.");
      return plaidJsonError("Missing public token.", 400);
    }

    const exchange = await plaidClient.itemPublicTokenExchange({
      public_token: body.public_token
    });
    const accessToken = exchange.data.access_token;
    const plaidItemId = exchange.data.item_id;
    const item = await plaidClient.itemGet({ access_token: accessToken });
    const institutionId = item.data.item.institution_id ?? null;
    let institutionName: string | null = null;

    if (institutionId) {
      try {
        const institution = await plaidClient.institutionsGetById({
          country_codes: plaidCountryCodes,
          institution_id: institutionId
        });
        institutionName = institution.data.institution.name;
      } catch (error) {
        console.error("[plaid/exchange-public-token] Could not fetch institution.", error);
        institutionName = null;
      }
    }

    const { data: plaidItem, error: itemError } = await authContext.supabase
      .from("plaid_items")
      .upsert(
        {
          access_token: accessToken,
          institution_id: institutionId,
          institution_name: institutionName,
          last_synced_at: new Date().toISOString(),
          plaid_item_id: plaidItemId,
          status: "active",
          user_id: user.id
        },
        { onConflict: "user_id,plaid_item_id" }
      )
      .select("id")
      .single();

    if (itemError || !plaidItem) {
      console.error("[plaid/exchange-public-token] Could not save Plaid item.", itemError);
      return plaidJsonError(itemError?.message ?? "Could not save Plaid item.", 500);
    }

    const accounts = await plaidClient.accountsBalanceGet({ access_token: accessToken });
    const accountRows = accounts.data.accounts.map((account) => ({
      available_balance: account.balances.available,
      current_balance: account.balances.current ?? 0,
      is_active: true,
      iso_currency_code: account.balances.iso_currency_code ?? "USD",
      mask: account.mask,
      name: account.name,
      official_name: account.official_name,
      plaid_account_id: account.account_id,
      plaid_item_id: plaidItem.id,
      subtype: account.subtype,
      type: account.type,
      user_id: user.id
    }));

    const { error: accountsError } = await authContext.supabase
      .from("accounts")
      .upsert(accountRows, { onConflict: "user_id,plaid_account_id" });

    if (accountsError) {
      console.error("[plaid/exchange-public-token] Could not save accounts.", accountsError);
      return plaidJsonError(accountsError.message, 500);
    }

    let transactionSync = null;

    try {
      transactionSync = await syncPlaidTransactions({
        accessToken,
        plaidClient,
        plaidItemId: plaidItem.id,
        supabase: authContext.supabase,
        userId: user.id
      });
    } catch (error) {
      const safeError = getSafeTransactionSyncError(error);

      console.error("[plaid/exchange-public-token] Transaction sync failed after account save.", {
        ...safeError,
        plaidItemId: plaidItem.id,
        userId: user.id
      });
    }

    return NextResponse.json({
      accounts_saved: accountRows.length,
      plaid_item_id: plaidItem.id,
      transaction_sync: transactionSync
    });
  } catch (error) {
    console.error("[plaid/exchange-public-token] Unexpected error.", error);
    return plaidJsonError("Could not connect bank account.", 500);
  }
}

async function readJsonBody(request: Request): Promise<ExchangeBody> {
  try {
    return (await request.json()) as ExchangeBody;
  } catch (error) {
    console.error("[plaid/exchange-public-token] Invalid request body.", error);
    return {};
  }
}

function plaidJsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}
