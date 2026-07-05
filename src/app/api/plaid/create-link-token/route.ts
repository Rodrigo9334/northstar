import { NextResponse } from "next/server";
import { getPlaidClient, plaidCountryCodes, plaidProducts, isPlaidServerConfigured } from "@/lib/plaid/client";
import { getSupabaseAuthContext } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    console.log("[plaid/create-link-token] Request received.", {
      countryCodes: plaidCountryCodes,
      clientIdLength: process.env.PLAID_CLIENT_ID?.length ?? 0,
      env: process.env.PLAID_ENV ?? "sandbox",
      hasClientId: Boolean(process.env.PLAID_CLIENT_ID),
      hasSecret: Boolean(process.env.PLAID_SECRET),
      products: plaidProducts
    });

    if (!isPlaidServerConfigured()) {
      console.error("[plaid/create-link-token] Plaid is not configured.");
      return plaidJsonError({ error: "Plaid is not configured." }, 500);
    }

    const plaidClient = await getPlaidClient();
    const authContext = getSupabaseAuthContext(request);

    if (!authContext) {
      console.error("[plaid/create-link-token] Missing Supabase session.");
      return plaidJsonError({ error: "Missing Supabase session." }, 401);
    }

    const {
      data: { user },
      error
    } = await authContext.supabase.auth.getUser(authContext.accessToken);

    if (error || !user) {
      console.error("[plaid/create-link-token] Invalid Supabase session.", error);
      return plaidJsonError({ error: "Invalid Supabase session." }, 401);
    }

    console.log("[plaid/create-link-token] Supabase user identified.", { userId: user.id });

    const response = await plaidClient.linkTokenCreate({
      client_name: "NorthStar",
      country_codes: plaidCountryCodes,
      language: "en",
      products: plaidProducts,
      user: {
        client_user_id: user.id
      }
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    const safeError = getSafePlaidError(error);

    console.error("[plaid/create-link-token] Failed.", safeError);
    return plaidJsonError(safeError, 500);
  }
}

type SafePlaidError = {
  code?: string;
  details?: string;
  error: string;
  plaid_error_code?: string;
  plaid_error_type?: string;
  plaid_request_id?: string;
};

function getSafePlaidError(error: unknown): SafePlaidError {
  if (isRecord(error)) {
    const response = isRecord(error.response) ? error.response : null;
    const data = response && isRecord(response.data) ? response.data : null;

    if (data) {
      const message = getString(data.error_message) ?? getString(data.display_message) ?? "Plaid returned an error.";

      return {
        code: getString(data.error_code),
        error: message,
        plaid_error_code: getString(data.error_code),
        plaid_error_type: getString(data.error_type),
        plaid_request_id: getString(data.request_id)
      };
    }

    const code = getString(error.code);
    const message = getString(error.message);

    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
      return {
        code,
        details: "Plaid SDK dependency loading failed. Reinstall project dependencies.",
        error: message ?? "Plaid SDK dependency loading failed."
      };
    }

    if (message) {
      return { code, error: message };
    }
  }

  if (error instanceof Error) {
    return { error: error.message };
  }

  return { error: "Could not create Plaid Link token." };
}

function plaidJsonError(safeError: Pick<SafePlaidError, "error"> & Partial<SafePlaidError>, status: number) {
  return NextResponse.json(safeError, { status });
}

function getString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
