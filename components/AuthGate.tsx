"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readSession, safeNextPath } from "@/lib/auth";
import AuthSplash from "./AuthSplash";

type Status = "checking" | "authenticated" | "anonymous";

/**
 * Sends unknown devices to /login and lets signed-in devices straight through.
 * The session lives in browser storage, so the check runs after mount and the
 * splash covers the first paint.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname === "/login";
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    setStatus(readSession() ? "authenticated" : "anonymous");
  }, [pathname]);

  useEffect(() => {
    if (isLoginRoute || status !== "anonymous") return;
    const next = safeNextPath(`${pathname}${window.location.search}`);
    router.replace(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
  }, [isLoginRoute, status, pathname, router]);

  if (isLoginRoute) return <>{children}</>;

  if (status === "authenticated") return <>{children}</>;

  return <AuthSplash />;
}
