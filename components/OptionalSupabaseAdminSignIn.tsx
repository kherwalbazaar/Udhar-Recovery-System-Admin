"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AccessState =
  | "checking"
  | "signed-out"
  | "authorized"
  | "not-admin"
  | "error"
  | "unconfigured";

export default function OptionalSupabaseAdminSignIn({
  onAuthorizationChange,
}: {
  onAuthorizationChange: (authorized: boolean) => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setAccessState("unconfigured");
      onAuthorizationChange(false);
      return;
    }

    let active = true;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAccessState("checking");
      onAuthorizationChange(false);
      setMessage(null);
    });

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Failed to read Supabase auth session", error);
          setMessage("Could not check Supabase sign-in. Please reload.");
          setAccessState("error");
        } else {
          setSession(data.session);
          setAccessState(data.session ? "checking" : "signed-out");
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("Failed to read Supabase auth session", error);
        setMessage("Could not check Supabase sign-in. Please reload.");
        setAccessState("error");
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [onAuthorizationChange]);

  useEffect(() => {
    const client = supabase;
    const userEmail = session?.user.email;
    if (!session) {
      setAccessState((current) =>
        current === "unconfigured" ? current : "signed-out"
      );
      onAuthorizationChange(false);
      return;
    }
    if (!client || !userEmail) {
      setAccessState("not-admin");
      onAuthorizationChange(false);
      return;
    }

    let active = true;
    setAccessState("checking");

    void (async () => {
      try {
        const { data, error } = await client
          .from("admin_users")
          .select("id")
          .eq("email", userEmail)
          .eq("role", "admin")
          .limit(1)
          .maybeSingle();

        if (!active) return;
        if (error) {
          console.error("Failed to verify Supabase admin access", error);
          setMessage(
            "Could not verify admin access. Apply the Supabase admin access migration."
          );
          setAccessState("error");
          onAuthorizationChange(false);
        } else if (data) {
          setMessage(null);
          setAccessState("authorized");
          onAuthorizationChange(true);
        } else {
          setMessage(null);
          setAccessState("not-admin");
          onAuthorizationChange(false);
        }
      } catch (error) {
        if (!active) return;
        console.error("Failed to verify Supabase admin access", error);
        setMessage("Could not verify admin access. Check your connection.");
        setAccessState("error");
        onAuthorizationChange(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [session, onAuthorizationChange]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = supabase;
    if (!client) {
      setAccessState("unconfigured");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        console.error("Supabase admin sign-in failed", error);
        setMessage("Sign-in failed. Check the email and password.");
      }
    } catch (error) {
      console.error("Supabase admin sign-in failed", error);
      setMessage("Could not sign in. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    const client = supabase;
    if (!client) return;

    setBusy(true);
    try {
      const { error } = await client.auth.signOut();
      if (error) {
        console.error("Supabase admin sign-out failed", error);
        setMessage("Could not sign out. Please try again.");
      }
    } catch (error) {
      console.error("Supabase admin sign-out failed", error);
      setMessage("Could not sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (accessState === "unconfigured") {
    return (
      <p className="text-xs text-rose-700">
        Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and a
        publishable or anon key in the deployment environment, then redeploy.
        The sale is saved to Firebase, but its amount cannot sync until then.
      </p>
    );
  }

  if (accessState === "checking") {
    return <p className="text-xs text-slate-600">Checking Supabase admin access...</p>;
  }

  if (accessState === "authorized") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-emerald-700">
          Supabase admin connected{session?.user.email ? `: ${session.user.email}` : ""}.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={busy}
          className="rounded-md border border-slate-300 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-white disabled:opacity-60"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (accessState === "not-admin") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-rose-700">
          {session
            ? "This Supabase account is not an admin in public.admin_users."
            : "Sign in with an authorized Supabase admin account to sync the amount."}
        </p>
        {session && (
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={busy}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Sign out
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-700">
        Sign in with an authorized Supabase admin account to sync the amount.
      </p>
      <form onSubmit={signIn} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Admin email"
          aria-label="Supabase admin email"
          className="min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs outline-none focus:border-blue-500"
        />
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          aria-label="Supabase admin password"
          className="min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Signing in..." : "Sign in to sync"}
        </button>
      </form>
      {message && (
        <p role="alert" className="text-xs text-rose-700">
          {message}
        </p>
      )}
    </div>
  );
}
