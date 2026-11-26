"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Heart,
  Lock,
  MapPin,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import AuthSplash from "@/components/AuthSplash";
import {
  ADMIN_EMAIL,
  readRememberedCredentials,
  readSession,
  safeNextPath,
  signIn,
} from "@/lib/auth";

const features = [
  { label: "Easy Sales Management", Icon: ShoppingCart, bg: "bg-[#0284c7]" },
  { label: "Khata & Customer Tracking", Icon: Users, bg: "bg-[#16a34a]" },
  { label: "Detailed Reports", Icon: BarChart3, bg: "bg-[#4f46e5]" },
  { label: "Cash Book & Finance", Icon: Wallet, bg: "bg-[#f97316]" },
  { label: "Reminders & Alerts", Icon: Bell, bg: "bg-[#ec4899]" },
];

const footerShop = "KHERWAL BAZAAR, Bahanada, Khunta, Mayurbhanj, Odisha";

function CounterIllustration() {
  return (
    <svg
      className="h-44 w-full max-w-xl drop-shadow-lg"
      viewBox="0 0 560 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="275" cy="166" rx="260" ry="12" fill="#bae6fd" fillOpacity="0.85" />

      <rect x="42" y="102" width="32" height="58" rx="5" fill="#1e293b" />
      <rect x="47" y="108" width="22" height="16" rx="2" fill="#38bdf8" />
      <rect x="35" y="148" width="46" height="14" rx="3" fill="#0f172a" />

      <path d="M126 124L142 154H168L154 124H126Z" fill="#334155" />
      <rect x="108" y="150" width="84" height="12" rx="3" fill="#0f172a" />
      <rect x="86" y="54" width="114" height="76" rx="8" fill="#1e293b" />
      <rect x="93" y="61" width="100" height="62" rx="4" fill="url(#posScreen)" />
      <defs>
        <linearGradient id="posScreen" x1="93" y1="61" x2="193" y2="123" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
      </defs>

      <rect x="216" y="112" width="76" height="48" rx="8" fill="#1e293b" />
      <rect x="226" y="118" width="56" height="6" rx="2" fill="#0f172a" />
      <path d="M232 120L238 78H274L270 120H232Z" fill="#ffffff" />
      <line x1="242" y1="86" x2="266" y2="86" stroke="#94a3b8" strokeWidth="2" />
      <line x1="241" y1="93" x2="262" y2="93" stroke="#94a3b8" strokeWidth="2" />
      <line x1="240" y1="100" x2="265" y2="100" stroke="#94a3b8" strokeWidth="2" />
      <line x1="239" y1="107" x2="258" y2="107" stroke="#0284c7" strokeWidth="2.5" />

      <path d="M352 46H406L412 126H346L352 46Z" fill="#ec4899" />
      <path d="M368 46C368 34 390 34 390 46" stroke="#be185d" strokeWidth="3" fill="none" />
      <path d="M312 58H368L374 134H306L312 58Z" fill="#0ea5e9" />
      <path d="M328 58C328 45 352 45 352 58" stroke="#0369a1" strokeWidth="3" fill="none" />

      <rect x="334" y="140" width="146" height="20" rx="9" fill="#f59e0b" />
      <rect x="338" y="144" width="138" height="6" rx="3" fill="#fbbf24" />
      <rect x="338" y="122" width="138" height="20" rx="9" fill="#db2777" />
      <rect x="342" y="126" width="130" height="6" rx="3" fill="#f472b6" />
      <rect x="342" y="104" width="130" height="20" rx="9" fill="#0284c7" />
      <path d="M388 104L407 113L426 104" fill="#38bdf8" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [ready, setReady] = useState(false);

  // Prefill remembered credentials and let an already signed-in device skip the form.
  useEffect(() => {
    const remembered = readRememberedCredentials();
    if (remembered) {
      setIdentifier(remembered.identifier);
      setPassword(remembered.password);
      setRemember(true);
    }

    if (readSession()) {
      const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
      router.replace(next);
      return;
    }

    setReady(true);
  }, [router]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    setError(null);
    setBusy(true);

    const result = signIn(identifier, password, remember);
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }

    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    router.replace(next);
  };

  if (!ready) {
    return <AuthSplash label="Checking saved login..." />;
  }

  const renderLoginForm = (mobile = false) => (
    <form className={mobile ? "mt-2.5 grid gap-2" : "login-form"} onSubmit={handleSubmit}>
      <div
        className={`relative flex items-center border border-slate-200 bg-slate-50/80 transition focus-within:border-[#0284c7] focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-100 ${
          mobile ? "rounded-xl px-3 py-2" : "login-field rounded-xl"
        }`}
      >
        <Users className={mobile ? "h-4 w-4 shrink-0 text-[#0f172a]" : "h-5 w-5 shrink-0 text-[#0f172a]"} aria-hidden="true" />
        <input
          type="text"
          name="username"
          autoComplete="username"
          placeholder="Username or Mobile Number"
          aria-label="Username or mobile number"
          required
          value={identifier}
          onChange={(event) => {
            setIdentifier(event.target.value);
            if (error) setError(null);
          }}
          className={`w-full bg-transparent font-medium text-slate-800 placeholder-slate-400 focus:outline-none ${
            mobile ? "ml-2.5 text-xs" : "ml-3 text-sm"
          }`}
        />
      </div>

      <div
        className={`relative flex items-center border border-slate-200 bg-slate-50/80 transition focus-within:border-[#0284c7] focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-100 ${
          mobile ? "rounded-xl px-3 py-2" : "login-field rounded-xl"
        }`}
      >
        <Lock className={mobile ? "h-4 w-4 shrink-0 text-[#0f172a]" : "h-5 w-5 shrink-0 text-[#0f172a]"} aria-hidden="true" />
        <input
          type={showPassword ? "text" : "password"}
          name="password"
          autoComplete="current-password"
          placeholder="Password"
          aria-label="Password"
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (error) setError(null);
          }}
          className={`w-full bg-transparent font-medium text-slate-800 placeholder-slate-400 focus:outline-none ${
            mobile ? "ml-2.5 text-xs" : "ml-3 text-sm"
          }`}
        />
        <button
          type="button"
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          onClick={() => setShowPassword((visible) => !visible)}
          className="ml-2 text-slate-500 hover:text-slate-800 focus:outline-none"
        >
          {showPassword ? (
            <Eye className={mobile ? "h-4 w-4" : "h-5 w-5"} aria-hidden="true" />
          ) : (
            <EyeOff className={mobile ? "h-4 w-4" : "h-5 w-5"} aria-hidden="true" />
          )}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className={`flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 font-semibold text-rose-700 ${
            mobile ? "px-2.5 py-1.5 text-[10px]" : "px-3.5 py-2.5 text-xs"
          }`}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className={`${mobile ? "text-[11px]" : "login-row"} flex items-center justify-between pt-0.5`}>
        <label className="flex cursor-pointer items-center gap-1.5 font-semibold text-[#0b2559]">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className={`${mobile ? "h-3.5 w-3.5" : "h-4 w-4"} rounded border-slate-300 text-[#0284c7] focus:ring-[#0284c7]`}
          />
          <span>Remember Me</span>
        </label>
        <button
          type="button"
          onClick={() => setShowHelp((open) => !open)}
          aria-expanded={showHelp}
          className="font-bold text-[#026aa7] hover:underline"
        >
          Forgot Password?
        </button>
      </div>

      {showHelp && (
        <div className={`rounded-xl border border-sky-200 bg-sky-50 font-medium leading-snug text-[#0b2559] ${
          mobile ? "px-2.5 py-2 text-[10px]" : "px-3.5 py-3 text-xs leading-relaxed"
        }`}>
          <p className="font-bold">Password help</p>
          <p className="mt-0.5">
            Sign in with{" "}
            <span className="font-bold">{ADMIN_EMAIL}</span>. Ask the shop owner
            if the password was changed.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className={`login-btn-shadow flex w-full items-center justify-center gap-2 bg-gradient-to-r from-[#10b981] via-[#0ea5e9] to-[#026aa7] font-bold text-white transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-80 ${
          mobile ? "mt-0.5 rounded-xl py-2.5 text-sm" : "login-submit rounded-xl"
        }`}
      >
        {busy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : (
          <CheckCircle2 className={mobile ? "h-4 w-4" : "h-5 w-5"} aria-hidden="true" />
        )}
        <span>{busy ? "Signing in..." : "Login"}</span>
      </button>
    </form>
  );

  return (
    <>
      {/* MOBILE LOGIN UI (< 768px) — compact full-fit viewport with zero scroll */}
      <div className="flex h-full min-h-0 w-full flex-1 select-none flex-col justify-between overflow-hidden bg-[#eff6ff] text-[#0b2559] md:hidden">
        {/* Top Hero Banner */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#071c47] via-[#0b3578] to-[#0369a1] px-4 pb-7 pt-3.5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-400/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-emerald-400/15 blur-2xl" />

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/95 p-0.5 shadow-lg shadow-slate-950/30 ring-2 ring-white/25">
              <Image
                src="/icon.png"
                alt="Udhar Recovery System"
                width={512}
                height={512}
                priority
                className="h-full w-full rounded-[13px] object-cover"
              />
            </div>
            <h1 className="mt-1.5 text-base font-extrabold tracking-tight text-white">
              KHERWAL BAZAAR
            </h1>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              Udhar Recovery System
            </p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Shop POS &amp; Khata
            </span>
          </div>
        </div>

        {/* Floating Login Card */}
        <div className="relative z-10 -mt-4 flex min-h-0 flex-1 flex-col justify-center px-3 py-1">
          <div className="login-card-shadow mx-auto w-full max-w-md rounded-2xl border border-white bg-white p-3.5">
            <div className="text-center">
              <h2 className="text-base font-extrabold tracking-tight text-[#0b2559]">
                Welcome Back!
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Sign in to manage sales, khata &amp; collections
              </p>
            </div>

            {renderLoginForm(true)}

            {/* Compact Features Strip */}
            <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2.5">
              {features.slice(0, 4).map(({ label, Icon, bg }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white ${bg}`}
                  >
                    <Icon className="h-3 w-3" aria-hidden="true" />
                  </span>
                  <span className="truncate text-[9px] font-bold text-slate-700">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Trust Badge */}
            <div className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-1.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16a34a]/15 text-[#16a34a]">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="text-left leading-tight">
                <p className="text-[11px] font-extrabold text-[#15803d]">
                  Secure &amp; Trusted
                </p>
                <p className="text-[9px] font-medium text-slate-600">
                  Real-time synced &amp; protected shop data
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Footer */}
        <footer className="w-full shrink-0 bg-[#044a75] px-3 py-2 text-white">
          <div className="mx-auto flex max-w-md flex-col items-center gap-0.5 text-center font-medium">
            <div className="flex items-center justify-center gap-1 text-[10px] text-sky-100">
              <MapPin className="h-3 w-3 shrink-0 text-amber-300" aria-hidden="true" />
              <span className="truncate">{footerShop}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-[9px] text-sky-200/90">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                Version 1.0
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                Made with{" "}
                <Heart className="h-2.5 w-2.5 text-[#ec4899]" fill="currentColor" aria-hidden="true" />{" "}
                for Your Business
              </span>
            </div>
          </div>
        </footer>
      </div>

      {/* DESKTOP LOGIN UI (>= 768px) */}
      <div className="login-page relative hidden min-h-0 w-full flex-1 select-none flex-col overflow-x-hidden bg-gradient-to-br from-[#dff3ff] via-[#eef8ff] to-[#cbe8fb] text-[#0b2559] md:flex">
      {/* Background: soft shelf silhouette, sweeping waves and diagonal light */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 -top-24 h-[520px] w-[520px] rounded-full bg-white/80 blur-3xl" />

        <svg
          className="absolute bottom-10 left-[22%] h-72 w-[480px] opacity-20 blur-[1px]"
          viewBox="0 0 480 280"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="20" y="20" width="440" height="240" rx="8" fill="#93c5fd" />
          <rect x="35" y="75" width="410" height="8" fill="#3b82f6" />
          <rect x="35" y="135" width="410" height="8" fill="#3b82f6" />
          <rect x="35" y="195" width="410" height="8" fill="#3b82f6" />
          <rect x="55" y="45" width="55" height="30" rx="4" fill="#0284c7" />
          <rect x="125" y="40" width="60" height="35" rx="4" fill="#10b981" />
          <rect x="205" y="48" width="50" height="27" rx="4" fill="#f59e0b" />
          <rect x="275" y="42" width="65" height="33" rx="4" fill="#ec4899" />
          <rect x="355" y="45" width="60" height="30" rx="4" fill="#6366f1" />

          <rect x="50" y="102" width="65" height="33" rx="4" fill="#ec4899" />
          <rect x="130" y="105" width="55" height="30" rx="4" fill="#0ea5e9" />
          <rect x="200" y="98" width="65" height="37" rx="4" fill="#8b5cf6" />
          <rect x="280" y="105" width="55" height="30" rx="4" fill="#14b8a6" />
          <rect x="350" y="100" width="65" height="35" rx="4" fill="#f97316" />

          <rect x="60" y="160" width="60" height="35" rx="4" fill="#14b8a6" />
          <rect x="135" y="163" width="65" height="32" rx="4" fill="#f43f5e" />
          <rect x="215" y="158" width="55" height="37" rx="4" fill="#0284c7" />
          <rect x="285" y="163" width="60" height="32" rx="4" fill="#eab308" />
        </svg>

        <svg
          className="absolute inset-x-0 bottom-8 h-48 w-full"
          viewBox="0 0 1440 200"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,45 C240,125 460,155 760,145 C1060,135 1280,85 1440,35 L1440,200 L0,200 Z"
            fill="#14b8a6"
            fillOpacity="0.85"
          />
          <path
            d="M0,105 C320,175 680,175 1040,120 C1230,90 1350,70 1440,65 L1440,200 L0,200 Z"
            fill="#0369a1"
            fillOpacity="0.9"
          />
          <path
            d="M0,130 C350,185 720,175 1440,115 L1440,200 L0,200 Z"
            fill="#e0f2fe"
            fillOpacity="0.35"
          />
        </svg>
      </div>

      <main className="login-main relative z-10 mx-auto flex min-h-0 w-full max-w-[1360px] flex-1 flex-col items-center justify-between lg:flex-row lg:items-stretch">
        {/* LEFT: branding, tagline, features and shop illustration */}
        <div className="flex w-full flex-col justify-between lg:w-[54%]">
          <div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-5">
              <div className="login-hero-logo relative flex shrink-0 items-center justify-center overflow-hidden rounded-[24%] shadow-lg shadow-sky-900/25 ring-4 ring-white/60">
                <Image
                  src="/icon.png"
                  alt="Udhar Recovery System"
                  width={512}
                  height={512}
                  priority
                  className="h-full w-full object-cover"
                />
              </div>

              <div>
                <h1 className="login-title font-extrabold leading-none tracking-tight text-[#0b3578]">
                  Udhar Recovery
                </h1>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className="login-title-2 font-extrabold leading-none tracking-tight text-[#0b3578]">
                    System
                  </span>
                  <span className="rounded-xl bg-[#10b981] px-4 py-1.5 text-lg font-bold text-white shadow-sm sm:text-2xl">
                    Admin
                  </span>
                </div>

                <p className="login-tagline font-bold italic text-[#0b2559]">
                  Smart Shop Management &amp; Khata System
                </p>
                <div className="mt-1.5 flex flex-col gap-1">
                  <div className="h-[2.5px] w-64 rounded-full bg-gradient-to-r from-transparent via-[#14b8a6] to-transparent"></div>
                  <div className="ml-6 h-[2px] w-48 rounded-full bg-gradient-to-r from-[#0ea5e9] to-transparent"></div>
                </div>
              </div>
            </div>

            <div className="login-banner inline-block w-full max-w-lg rounded-2xl border border-white/70 bg-white/45 text-center shadow-sm backdrop-blur-sm">
              <h2 className="login-banner-title font-extrabold italic tracking-tight text-[#0b3578]">
                Manage Your Business Smartly...
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2.5 text-xs font-bold text-[#0b2559] sm:text-sm">
                <span>Sales</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#14b8a6]"></span>
                <span>Khata</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#14b8a6]"></span>
                <span>Reports</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#14b8a6]"></span>
                <span>More</span>
              </div>
            </div>

            <ul className="login-features">
              {features.map(({ label, Icon, bg }) => (
                <li key={label} className="login-feature">
                  <span
                    className={`login-feature-icon feature-badge-shadow flex shrink-0 items-center justify-center rounded-lg text-white ${bg}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="login-feature-label font-bold text-[#0b2559]">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="login-illustration">
            <CounterIllustration />
          </div>
        </div>

        {/* RIGHT: login card */}
        <div className="flex w-full items-center justify-center lg:w-[44%]">
          <div className="login-card login-card-shadow relative w-full max-w-[460px] rounded-[28px] border border-white bg-white/95 backdrop-blur-md">
            <div className="flex flex-col items-center text-center">
              <div className="login-logo flex items-center justify-center overflow-hidden rounded-[26%] shadow-lg shadow-sky-900/20 ring-4 ring-[#e0f2fe]">
                <Image
                  src="/icon.png"
                  alt="Udhar Recovery System"
                  width={512}
                  height={512}
                  priority
                  className="h-full w-full object-cover"
                />
              </div>

              <h2 className="login-welcome font-extrabold tracking-tight text-[#0b2559]">
                Welcome Back!
              </h2>
              <p className="login-subtitle font-medium text-[#1e3a8a]/85">
                Login to your Udhar Recovery System
              </p>
            </div>

            {renderLoginForm(false)}

            <div className="login-divider relative flex items-center justify-center">
              <div className="h-[1px] w-full bg-slate-200"></div>
              <span className="mx-3 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                or
              </span>
              <div className="h-[1px] w-full bg-slate-200"></div>
            </div>

            <div className="login-trust flex items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-[#f1f6fa]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#16a34a]/15 text-[#16a34a]">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="text-left leading-tight">
                <p className="text-sm font-extrabold text-[#15803d]">Secure &amp; Trusted</p>
                <p className="text-xs font-medium text-slate-600">Your data is safe with us</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="login-footer relative z-10 w-full shrink-0 bg-[#044a75] text-white shadow-inner">
        <div className="mx-auto flex max-w-[1360px] flex-col items-center justify-between gap-2 text-xs font-medium sm:flex-row sm:text-[13px]">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{footerShop}</span>
          </div>

          <span className="hidden h-4 w-[1px] bg-white/30 md:inline-block"></span>

          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Version 1.0</span>
          </div>

          <span className="hidden h-4 w-[1px] bg-white/30 md:inline-block"></span>

          <div className="flex items-center gap-1.5">
            <span>Made with</span>
            <Heart className="h-4 w-4 text-[#ec4899]" fill="currentColor" aria-hidden="true" />
            <span>for Your Business</span>
          </div>
        </div>
      </footer>
      </div>
    </>
  );
}
