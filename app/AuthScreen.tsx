"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { LEGAL_VERSION, MIN_AGE } from "@/lib/legal";
import { ThemeToggle } from "./ThemeToggle";

type AuthMode = "signin" | "signup";

const MIN_PASSWORD = 8;

// Supabase's messages are written for developers; reword the common ones.
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Try again.";
  if (m.includes("already registered")) return "An account with that email already exists. Sign in instead.";
  if (m.includes("email not confirmed")) return "Confirm your email address first, then sign in.";
  if (m.includes("rate limit")) return "Too many attempts. Wait a minute and try again.";
  return message;
}

/** Recorded on the account when a student agrees (see ConsentScreen, sign-up). */
export function consentMetadata() {
  return { terms_version: LEGAL_VERSION, terms_accepted_at: new Date().toISOString() };
}

// "I agree" checkbox with links to both documents. Links open in a new tab so a
// half-filled form isn't lost.
function AgreeCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="auth-agree">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        I&apos;m at least {MIN_AGE} years old and I agree to the{" "}
        <Link href="/terms" target="_blank">Terms of Use</Link> and{" "}
        <Link href="/privacy" target="_blank">Privacy Policy</Link>.
      </span>
    </label>
  );
}

function LegalLinks() {
  return (
    <p className="auth-legal">
      <Link href="/privacy">Privacy</Link>
      <span aria-hidden="true"> · </span>
      <Link href="/terms">Terms</Link>
    </p>
  );
}

// Shown instead of the app until the student signs in. Email + password only;
// once a session exists, app/page.tsx swaps this for the tutor.
export function AuthScreen({ notice = null }: { notice?: string | null }) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(notice);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === "signup" && password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
      return;
    }
    setBusy(true);
    try {
      const auth = supabase().auth;
      const creds = { email: email.trim(), password };
      const { data, error } =
        mode === "signin"
          ? await auth.signInWithPassword(creds)
          : await auth.signUp({ ...creds, options: { data: consentMetadata() } });
      if (error) {
        setError(friendlyError(error.message));
      } else if (!data.session) {
        // Only happens if "Confirm email" is on in Supabase Auth settings.
        setMode("signin");
        setInfo("Account created. Check your email to confirm it, then sign in.");
      }
      // On success the auth listener in app/page.tsx shows the app.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const signingUp = mode === "signup";

  return (
    <main className="auth-wrap">
      <div className="auth-theme">
        <ThemeToggle />
      </div>
      <div className="auth-card">
        <div className="auth-brand">
          <span className="logo-mark" aria-hidden="true">
            <span className="r-letter">R</span>
            <span className="e-letter">E</span>
          </span>
          <span className="logo-name">Ransom Tutor</span>
        </div>
        <h1 className="auth-title">{signingUp ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-sub">
          {signingUp
            ? "Your progress and chats are saved to your account, so they follow you to any device."
            : "Sign in to pick up where you left off."}
        </p>

        <form onSubmit={onSubmit} className="auth-form" noValidate>
          <label className="auth-label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            className="auth-input"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="auth-label" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            className="auth-input"
            type="password"
            autoComplete={signingUp ? "new-password" : "current-password"}
            required
            minLength={signingUp ? MIN_PASSWORD : undefined}
            aria-describedby={signingUp ? "auth-password-hint" : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {signingUp && (
            <p className="auth-hint" id="auth-password-hint">
              At least {MIN_PASSWORD} characters.
            </p>
          )}
          {signingUp && <AgreeCheckbox checked={agreed} onChange={setAgreed} />}

          <div role="alert" aria-live="assertive">
            {error && <p className="auth-error">{error}</p>}
          </div>
          <div role="status" aria-live="polite">
            {info && <p className="auth-info">{info}</p>}
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={busy || !email.trim() || !password || (signingUp && !agreed)}
          >
            {busy ? "One moment..." : signingUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {signingUp ? "Already have an account?" : "New here?"}{" "}
          <button type="button" onClick={() => switchMode(signingUp ? "signin" : "signup")}>
            {signingUp ? "Sign in" : "Create an account"}
          </button>
        </p>
        <LegalLinks />
      </div>
    </main>
  );
}

// Shown after sign-in when the account hasn't agreed to the current Terms and
// Privacy Policy (LEGAL_VERSION changed, or the account predates consent).
export function ConsentScreen({ email, updated }: { email: string; updated: boolean }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    // On success the auth listener in app/page.tsx sees the new metadata and shows the app.
    const { error } = await supabase().auth.updateUser({ data: consentMetadata() });
    if (error) setError(friendlyError(error.message));
    setBusy(false);
  }

  return (
    <main className="auth-wrap">
      <div className="auth-theme">
        <ThemeToggle />
      </div>
      <div className="auth-card">
        <h1 className="auth-title">{updated ? "We've updated our terms" : "One more step"}</h1>
        <p className="auth-sub">
          {updated
            ? "Please review the updated Terms of Use and Privacy Policy to keep using Ransom Tutor."
            : "Please review and agree to the Terms of Use and Privacy Policy to use Ransom Tutor."}
        </p>
        <AgreeCheckbox checked={agreed} onChange={setAgreed} />
        <div role="alert" aria-live="assertive">
          {error && <p className="auth-error">{error}</p>}
        </div>
        <div className="auth-form">
          <button type="button" className="auth-submit" disabled={!agreed || busy} onClick={accept}>
            {busy ? "One moment..." : "Continue"}
          </button>
        </div>
        <p className="auth-switch">
          Signed in as {email}.{" "}
          <button type="button" onClick={() => void supabase().auth.signOut()}>
            Sign out
          </button>
        </p>
      </div>
    </main>
  );
}
