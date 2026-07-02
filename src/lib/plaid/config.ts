export const plaidConfig = {
  clientId: process.env.PLAID_CLIENT_ID,
  env: process.env.PLAID_ENV ?? "sandbox",
  secret: process.env.PLAID_SECRET
};

export function isPlaidConfigured() {
  return Boolean(plaidConfig.clientId && plaidConfig.secret);
}
