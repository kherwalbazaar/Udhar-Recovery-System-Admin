"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readSession, safeNextPath } from "@/lib/auth";
import AuthSplash from "./AuthSplash";
import MobileUserApp, { MOBILE_ROUTE_TO_TAB } from "./MobileUserApp";

type Status = "checking" | "authenticated" | "anonymous";

/**
 * Sends unknown devices to /login and lets signed-in devices straight through.
 * On mobile/small screens (< 768px), synced routes render the unified mobile
 * User UI while desktop screens render the Admin pages.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname === "/login";
  const [status, setStatus] = useState<Status>("checking");
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    setStatus(readSession() ? "authenticated" : "anonymous");
  }, [pathname]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (isLoginRoute || status !== "anonymous") return;
    const next = safeNextPath(`${pathname}${window.location.search}`);
    router.replace(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
  }, [isLoginRoute, status, pathname, router]);

  if (isLoginRoute) return <>{children}</>;

  if (status !== "authenticated" || isMobile === null) {
    return <AuthSplash />;
  }

  const normalizedPath = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (isMobile && normalizedPath in MOBILE_ROUTE_TO_TAB) {
    return <MobileUserApp currentPath={normalizedPath} />;
  }

  return <>{children}</>;
}
