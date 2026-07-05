import type { CountryCode, Products } from "plaid";

export const plaidProducts = ["transactions" as Products];
export const plaidCountryCodes = ["US" as CountryCode];

export function isPlaidServerConfigured() {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export async function getPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const plaidEnv = (process.env.PLAID_ENV ?? "sandbox").toLowerCase();

  if (!clientId || !secret) {
    throw new Error("Plaid environment variables are missing.");
  }

  const { Configuration, PlaidApi, PlaidEnvironments } = await import("plaid");

  return new PlaidApi(
    new Configuration({
      basePath:
        PlaidEnvironments[plaidEnv as keyof typeof PlaidEnvironments] ??
        PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret
        }
      }
    })
  );
}
