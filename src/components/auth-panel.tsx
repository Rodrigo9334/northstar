"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Compass } from "lucide-react";
import { useState } from "react";

type AuthPanelProps = {
  supabase: SupabaseClient;
};

type AuthMode = "login" | "password-help";

export function AuthPanel({ supabase }: AuthPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<AuthMode>("login");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSendingPasswordEmail, setIsSendingPasswordEmail] = useState(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSigningIn(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setIsSigningIn(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("You're signed in. Loading NorthStar...");
  }

  async function sendPasswordEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSendingPasswordEmail(true);
    setError("");
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window === "undefined" ? undefined : window.location.origin
    });

    setIsSendingPasswordEmail(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Check your email for a secure password setup link.");
  }

  function showPasswordHelp() {
    setError("");
    setMessage("");
    setMode("password-help");
  }

  function showLogin() {
    setError("");
    setMessage("");
    setMode("login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-md border border-white/10 bg-panel/90 p-6 shadow-glow">
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-mint text-ink">
          <Compass size={22} />
        </span>
        <h1 className="mt-6 text-3xl font-semibold">Sign in to NorthStar</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Use your Supabase account to load your private accounts, budgets, transactions, and goals.
        </p>

        {mode === "login" ? (
          <form className="mt-6 space-y-4" onSubmit={signIn}>
            <label className="block text-sm font-medium text-slate-300" htmlFor="email">
              Email
            </label>
            <input
              autoComplete="email"
              className="min-h-12 w-full rounded-md border border-white/10 bg-ink/80 px-4 text-white outline-none transition focus:border-mint/70"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />

            <label className="block text-sm font-medium text-slate-300" htmlFor="password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="min-h-12 w-full rounded-md border border-white/10 bg-ink/80 px-4 text-white outline-none transition focus:border-mint/70"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              type="password"
              value={password}
            />

            <button
              className="min-h-12 w-full rounded-md bg-mint px-4 font-semibold text-ink transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSigningIn}
              type="submit"
            >
              {isSigningIn ? "Signing in..." : "Sign in"}
            </button>
            <button
              className="min-h-12 w-full rounded-md border border-white/10 px-4 font-semibold text-slate-200 transition hover:bg-white/[0.06]"
              onClick={showPasswordHelp}
              type="button"
            >
              Create password or forgot password
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={sendPasswordEmail}>
            <label className="block text-sm font-medium text-slate-300" htmlFor="password-email">
              Email
            </label>
            <input
              autoComplete="email"
              className="min-h-12 w-full rounded-md border border-white/10 bg-ink/80 px-4 text-white outline-none transition focus:border-mint/70"
              id="password-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
            <button
              className="min-h-12 w-full rounded-md bg-mint px-4 font-semibold text-ink transition hover:bg-mint/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSendingPasswordEmail}
              type="submit"
            >
              {isSendingPasswordEmail ? "Sending..." : "Send password setup email"}
            </button>
            <button
              className="min-h-12 w-full rounded-md border border-white/10 px-4 font-semibold text-slate-200 transition hover:bg-white/[0.06]"
              onClick={showLogin}
              type="button"
            >
              Back to sign in
            </button>
          </form>
        )}

        {error ? <p className="mt-4 text-sm text-rose">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-slate-300">{message}</p> : null}
      </section>
    </main>
  );
}
