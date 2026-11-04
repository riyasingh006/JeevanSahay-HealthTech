"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Check,
  Eye,
  EyeOff,
  HeartPulse,
  Info,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";
import authBackground from "@/components/landing/logo/doc.jpg";
import { useAuth } from "@/components/auth-context";
import { cn } from "@/lib/utils";

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
}

type Role = "patient" | "hospital" | "admin" | null;

const ROLES: { id: Exclude<Role, null>; title: string; desc: string; icon: typeof HeartPulse }[] = [
  {
    id: "patient",
    title: "Patient Application",
    desc: "Find hospitals, specialists and healthcare services.",
    icon: HeartPulse,
  },
  {
    id: "hospital",
    title: "Hospital Portal",
    desc: "Manage hospital information and healthcare availability.",
    icon: Building2,
  },
  {
    id: "admin",
    title: "Admin Portal",
    desc: "Manage platform operations and administrative services.",
    icon: ShieldCheck,
  },
];

/* ------------------------- static modal shell ------------------------- */

function Modal({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#031C45]/45 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_24px_64px_rgba(3,28,69,0.22)]"
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------ OTP boxes ----------------------------- */

function OtpBoxes({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? "");

  const setDigit = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join("").slice(0, 6));
    if (digit && index < 5) refs.current[index + 1]?.focus();
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="6-digit OTP">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => { refs.current[index] = element; }}
          value={digit}
          onChange={(event) => setDigit(index, event.target.value.replace(/\D/g, "").slice(-1))}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            if (pasted) {
              event.preventDefault();
              onChange(pasted);
              refs.current[Math.min(pasted.length, 5)]?.focus();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus();
          }}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1}`}
          className="h-12 w-full rounded-[10px] border border-[#D7E0EC] bg-white text-center text-lg font-bold text-[#102A56] outline-none transition-colors focus:border-[#062B67] focus:ring-2 focus:ring-[#062B67]/15"
        />
      ))}
    </div>
  );
}

/* ------------------------------- form --------------------------------- */

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const reason = params.get("reason");
  const { refresh } = useAuth();

  const [role, setRole] = React.useState<Role>(null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(true);
  const [otpCode, setOtpCode] = React.useState("");
  const [otpSent, setOtpSent] = React.useState(false);
  const [otpLoading, setOtpLoading] = React.useState(false);
  const [otpSeconds, setOtpSeconds] = React.useState(0);
  const [otpNote, setOtpNote] = React.useState("");
  const [recoveryStep, setRecoveryStep] = React.useState<"email" | "code" | "password" | "done">("email");
  const [recoveryEmail, setRecoveryEmail] = React.useState("");
  const [recoveryCode, setRecoveryCode] = React.useState("");
  const [recoveryPassword, setRecoveryPassword] = React.useState("");
  const [recoveryConfirm, setRecoveryConfirm] = React.useState("");
  const [recoveryLoading, setRecoveryLoading] = React.useState(false);
  const [recoveryError, setRecoveryError] = React.useState("");
  const [recoveryMessage, setRecoveryMessage] = React.useState("");
  const [recoverySeconds, setRecoverySeconds] = React.useState(0);
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [roleHint, setRoleHint] = React.useState(false);

  React.useEffect(() => {
    const err = params.get("error") ?? params.get("reason");
    if (!err) return;
    const map: Record<string, string> = {
      google_cancelled: "Google sign-in was cancelled.",
      google_invalid: "Invalid Google sign-in request. Please try again.",
      google_state_mismatch: "Security validation failed. Please try again.",
      google_config_missing: "Google OAuth is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      google_email_missing: "Google account has no email. Please use another account.",
      google_email_unverified: "Google could not verify this email address. Please use another account.",
      google_account_link_conflict: "This Google account is linked to a different sign-in. Contact support.",
      hospital_application_pending: "Your hospital account is awaiting administrator verification.",
      "hospital-rejected": "Your hospital application was not approved. Check the decision email or contact support.",
      account_suspended: "This account has been suspended. Contact support.",
      account_inactive: "This account is not active. Contact support.",
      google_failed: "Google sign-in failed. Please try again.",
    };
    setError(map[err] || "Google sign-in failed. Please try again.");
  }, [params]);
  const [modal, setModal] = React.useState<"forgot" | "otp" | null>(null);

  React.useEffect(() => {
    if (otpSeconds <= 0 && recoverySeconds <= 0) return;
    const timer = window.setInterval(() => {
      setOtpSeconds((value) => Math.max(0, value - 1));
      setRecoverySeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpSeconds, recoverySeconds]);

  function destinationForRole(accountRole: string): string {
    if (accountRole === "HOSPITAL_ADMIN") return "/hospital";
    if (accountRole === "SUPER_ADMIN") return "/admin";
    return next === "/dashboard" || next === "/" ? "/dashboard" : next;
  }

  async function finishLogin(accountRole: string) {
    if (!["PATIENT", "HOSPITAL_ADMIN", "SUPER_ADMIN"].includes(accountRole)) {
      setError("This account is not authorised to sign in. Contact support.");
      return;
    }
    await refresh();
    router.replace(destinationForRole(accountRole));
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!role) {
      setRoleHint(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        if (json.code === "EMAIL_VERIFICATION_REQUIRED") {
          const query = new URLSearchParams({
            email: json.email ?? email,
            role: json.role ?? "PATIENT",
            next,
            ...(json.deliveryPending ? { delivery: "pending" } : {}),
          });
          router.replace(`/verify-email?${query.toString()}`);
          return;
        }
        setError(json.error ?? "Unable to sign in. Please try again.");
        return;
      }
      await finishLogin(json.data?.user?.role ?? "");
    } catch {
      setError("Network problem — please check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  async function requestEmailCode() {
    setOtpNote("");
    if (!role) {
      setRoleHint(true);
      setOtpNote("Select your account type first.");
      return;
    }
    setOtpLoading(true);
    try {
      const response = await fetch("/api/auth/email-code/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setOtpNote(result.error ?? "We could not process that request.");
        return;
      }
      setOtpSent(true);
      setOtpCode("");
      setOtpSeconds(60);
      setOtpNote(result.data?.smtpConfigured === false
        ? "Email delivery is not configured, so a sign-in code cannot be sent yet. Please contact support."
        : result.data?.message ?? "If this address belongs to an eligible account, a sign-in code has been sent.");
    } catch {
      setOtpNote("Network problem — please check your connection and retry.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function verifyEmailCode() {
    setOtpNote("");
    setOtpLoading(true);
    try {
      const response = await fetch("/api/auth/email-code/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, code: otpCode, rememberMe }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setOtpNote(result.error ?? "That code is invalid or expired.");
        return;
      }
      setModal(null);
      await finishLogin(result.data?.user?.role ?? "");
    } catch {
      setOtpNote("Network problem — please check your connection and retry.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function requestRecoveryCode() {
    setRecoveryError("");
    setRecoveryLoading(true);
    try {
      const response = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: recoveryEmail }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setRecoveryError(result.error ?? "We could not process that request.");
        return;
      }
      setRecoveryMessage(result.data?.smtpConfigured === false
        ? "Email delivery is not configured, so a recovery code cannot be sent yet. Please contact support."
        : result.data?.message ?? "If this address belongs to an eligible account, a recovery code has been sent.");
      setRecoveryStep("code");
      setRecoveryCode("");
      setRecoverySeconds(60);
    } catch {
      setRecoveryError("Network problem — please check your connection and retry.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function verifyRecoveryCode(event: React.FormEvent) {
    event.preventDefault();
    setRecoveryError("");
    setRecoveryLoading(true);
    try {
      const response = await fetch("/api/auth/password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: recoveryEmail, code: recoveryCode }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setRecoveryError(result.error ?? "That code is invalid or expired.");
        return;
      }
      setRecoveryStep("password");
    } catch {
      setRecoveryError("Network problem — please check your connection and retry.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function resetPassword(event: React.FormEvent) {
    event.preventDefault();
    setRecoveryError("");
    if (recoveryPassword !== recoveryConfirm) {
      setRecoveryError("The passwords do not match.");
      return;
    }
    setRecoveryLoading(true);
    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ password: recoveryPassword, confirmPassword: recoveryConfirm }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setRecoveryError(result.error ?? "We could not update your password.");
        return;
      }
      setRecoveryMessage(result.data?.message ?? "Your password has been updated. Sign in with your new password.");
      setRecoveryStep("done");
    } catch {
      setRecoveryError("Network problem — please check your connection and retry.");
    } finally {
      setRecoveryLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* ---------- hospital corridor background ---------- */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 31, 63, 0.08), rgba(0, 31, 63, 0.08)), url(${authBackground.src})`,
        }}
      />

      <div className="relative space-y-5">
      {/* ---------- heading ---------- */}
      <div className="text-center">
        <h1 className="text-[32px] font-bold leading-tight text-[#062B67]">Sign In</h1>
        <p className="mt-1.5 text-[15px] text-[#5A6B85]">Access your Jeevan Sahay account.</p>
      </div>

      {reason === "auth" && (
        <p className="flex items-start gap-2 rounded-lg border border-saffron-200 bg-saffron-50 px-3.5 py-2.5 text-xs font-medium text-saffron-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Please sign in to continue to that page.
        </p>
      )}

      {/* ---------- card ---------- */}
      <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-6 shadow-[0_20px_50px_rgba(3,29,69,0.18)] sm:p-9">
        <form onSubmit={onSubmit} className="space-y-6" noValidate={false}>
          {/* ---- role selection FIRST ---- */}
          <fieldset>
            <legend className="text-sm font-bold text-[#102A56]">Select your role</legend>
            <div
              role="radiogroup"
              aria-label="Select your role"
              className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
              {ROLES.map(({ id, title, desc, icon: Icon }) => {
                const selected = role === id;
                return (
                  <label
                    key={id}
                    className={cn(
                      "relative flex cursor-pointer flex-col rounded-2xl border bg-white p-4 transition-all duration-150",
                      selected
                        ? "border-[#062B67] bg-[#EEF4FC] shadow-[0_10px_26px_-12px_rgba(6,43,103,0.45)]"
                        : "border-[#DCE4EF] hover:border-[#B9CBE3] hover:shadow-sm"
                    )}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={id}
                      checked={selected}
                      onChange={() => { setRole(id); setRoleHint(false); }}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between">
                      <span
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                          selected ? "bg-[#062B67] text-white" : "bg-[#EEF3FB] text-[#2563EB]"
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                          selected ? "border-[#062B67] bg-[#062B67]" : "border-[#C7D3E6]"
                        )}
                      >
                        {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </span>
                    </span>
                    <span className="mt-3 block text-[13.5px] font-bold leading-snug text-[#102A56]">
                      {title}
                      {selected && <span className="sr-only"> (selected)</span>}
                    </span>
                    <span className="mt-1 block text-[11.5px] leading-relaxed text-[#64748B]">
                      {desc}
                    </span>
                  </label>
                );
              })}
            </div>
            {roleHint && !role && (
              <p role="alert" className="mt-2 text-xs font-medium text-red-600">
                Please select your role to continue.
              </p>
            )}
          </fieldset>

          {/* ---- email ---- */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-bold text-[#102A56]">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#94A3B8]" aria-hidden />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-[52px] w-full rounded-xl border border-[#D7E0EC] bg-white pl-11 pr-4 text-[14px] text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#062B67] focus:ring-2 focus:ring-[#062B67]/15"
              />
            </div>
          </div>

          {/* ---- password ---- */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className="block text-sm font-bold text-[#102A56]">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setRecoveryEmail(email);
                  setRecoveryStep("email");
                  setRecoveryError("");
                  setRecoveryMessage("");
                  setModal("forgot");
                }}
                className="text-[12.5px] font-semibold text-[#2563EB] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#062B67]"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#94A3B8]" aria-hidden />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-[52px] w-full rounded-xl border border-[#D7E0EC] bg-white pl-11 pr-12 text-[14px] text-[#102A56] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#062B67] focus:ring-2 focus:ring-[#062B67]/15"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#94A3B8] transition-colors hover:text-[#102A56] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#062B67]"
              >
                {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-[#64748B]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-[#CBD5E1] accent-[#062B67]"
            />
            Keep me signed in for 7 days
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              {error}
            </p>
          )}

          {/* ---- submit ---- */}
          <button
            type="submit"
            disabled={loading}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#062B67] text-[15px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(6,43,103,0.65)] transition-all duration-150 hover:bg-[#0A377E] active:translate-y-px disabled:cursor-wait disabled:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#062B67]"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
            ) : (
              <LogIn className="h-4 w-4" aria-hidden />
            )}
            Sign In
          </button>

          {/* ---- divider + google + otp ---- */}
          <div className="pt-1">
            <div className="flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-[#E2E8F0]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">OR</span>
              <span className="h-px flex-1 bg-[#E2E8F0]" />
            </div>

          <a
            href="/api/auth/google"
            onClick={() => setError("")}
            className="mt-4 flex h-[50px] w-full items-center justify-center gap-3 rounded-[10px] border border-[#D7E0EC] bg-white text-[14px] font-bold text-[#102A56] transition-colors hover:bg-[#F5F8FC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#062B67]"
          >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 40.4 44 35 44 24c0-1.3-.1-2.6-.4-3.9z"/>
              </svg>
              Continue with Google
            </a>

            <button
              type="button"
              onClick={() => {
                setOtpNote("");
                setOtpSent(false);
                setOtpCode("");
                setEmail(email);
                setModal("otp");
              }}
              className="mx-auto mt-3.5 block text-[13px] font-semibold text-[#2563EB] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#062B67]"
            >
              Use OTP instead
            </button>
          </div>
        </form>

        {/* ---- create account ---- */}
        <p className="mt-6 border-t border-[#EEF2F8] pt-5 text-center text-sm text-[#64748B]">
          New to Jeevan Sahay?{" "}
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            className="font-bold text-[#2563EB] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#062B67]"
          >
            Create an account
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-[#64748B]">
          Hospital administrator?{" "}
          <Link
            href={`/signup?role=HOSPITAL_ADMIN&next=${encodeURIComponent(next)}`}
            className="font-bold text-[#2563EB] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#062B67]"
          >
            Register your hospital
          </Link>
        </p>
        {role === "admin" && (
          <p role="note" className="mt-3 text-center text-xs text-[#64748B]">
            Super-admin accounts are provisioned by the platform; there is no public admin registration.
          </p>
        )}
      </div>

      {/* ---------------------- static modals ---------------------- */}
      {modal === "forgot" && (
        <Modal labelledBy="forgot-title" onClose={() => setModal(null)}>
          <div className="flex items-start justify-between gap-3">
            <h2 id="forgot-title" className="text-lg font-bold text-[#102A56]">
              {recoveryStep === "done" ? "Password updated" : "Reset your password"}
            </h2>
            <button
              type="button"
              onClick={() => setModal(null)}
              aria-label="Close"
              className="rounded-md p-1 text-[#94A3B8] hover:text-[#102A56] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#062B67]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#64748B]">
            {recoveryStep === "email" && "Enter your account email. If it is registered, we will send a recovery code."}
            {recoveryStep === "code" && (recoveryMessage || "Enter the six-digit recovery code sent to your email.")}
            {recoveryStep === "password" && "Choose a new password with at least 12 characters, including upper-case, lower-case and numeric characters."}
            {recoveryStep === "done" && recoveryMessage}
          </p>
          {recoveryStep === "email" && (
            <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void requestRecoveryCode(); }}>
              <label htmlFor="recovery-email" className="block text-sm font-semibold text-[#102A56]">Email address</label>
              <input id="recovery-email" type="email" required maxLength={254} autoComplete="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} className="h-11 w-full rounded-lg border border-[#D7E0EC] px-3 text-sm text-[#102A56] outline-none focus:border-[#062B67] focus:ring-2 focus:ring-[#062B67]/15" />
              {recoveryError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{recoveryError}</p>}
              <button type="submit" disabled={recoveryLoading} className="h-11 w-full rounded-[10px] bg-[#062B67] text-sm font-bold text-white disabled:opacity-60">
                {recoveryLoading ? "Sending…" : "Send recovery code"}
              </button>
            </form>
          )}
          {recoveryStep === "code" && (
            <form className="mt-4 space-y-3" onSubmit={verifyRecoveryCode}>
              <OtpBoxes value={recoveryCode} onChange={setRecoveryCode} />
              {recoveryError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{recoveryError}</p>}
              <button type="submit" disabled={recoveryLoading || recoveryCode.length !== 6} className="h-11 w-full rounded-[10px] bg-[#062B67] text-sm font-bold text-white disabled:opacity-60">
                {recoveryLoading ? "Checking…" : "Verify code"}
              </button>
              <button type="button" disabled={recoverySeconds > 0 || recoveryLoading} onClick={() => void requestRecoveryCode()} className="w-full text-sm font-semibold text-[#2563EB] disabled:text-slate-400">
                {recoverySeconds > 0 ? `Resend code in ${recoverySeconds}s` : "Resend recovery code"}
              </button>
              <button type="button" onClick={() => { setRecoveryStep("email"); setRecoveryError(""); }} className="w-full text-xs text-[#64748B] hover:underline">Use a different email address</button>
            </form>
          )}
          {recoveryStep === "password" && (
            <form className="mt-4 space-y-3" onSubmit={resetPassword}>
              <label htmlFor="recovery-password" className="block text-sm font-semibold text-[#102A56]">New password</label>
              <input id="recovery-password" type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={recoveryPassword} onChange={(event) => setRecoveryPassword(event.target.value)} className="h-11 w-full rounded-lg border border-[#D7E0EC] px-3 text-sm text-[#102A56] outline-none focus:border-[#062B67] focus:ring-2 focus:ring-[#062B67]/15" />
              <label htmlFor="recovery-confirm" className="block text-sm font-semibold text-[#102A56]">Confirm new password</label>
              <input id="recovery-confirm" type="password" required minLength={12} maxLength={72} autoComplete="new-password" value={recoveryConfirm} onChange={(event) => setRecoveryConfirm(event.target.value)} className="h-11 w-full rounded-lg border border-[#D7E0EC] px-3 text-sm text-[#102A56] outline-none focus:border-[#062B67] focus:ring-2 focus:ring-[#062B67]/15" />
              {recoveryError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{recoveryError}</p>}
              <button type="submit" disabled={recoveryLoading} className="h-11 w-full rounded-[10px] bg-[#062B67] text-sm font-bold text-white disabled:opacity-60">
                {recoveryLoading ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
          {recoveryStep === "done" && (
            <button type="button" onClick={() => setModal(null)} className="mt-5 h-10 w-full rounded-[10px] bg-[#062B67] text-sm font-bold text-white transition-colors hover:bg-[#0A377E]">Return to sign in</button>
          )}
        </Modal>
      )}

      {modal === "otp" && (
        <Modal labelledBy="otp-title" onClose={() => setModal(null)}>
          <div className="flex items-start justify-between gap-3">
            <h2 id="otp-title" className="text-lg font-bold text-[#102A56]">Email code sign-in</h2>
            <button
              type="button"
              onClick={() => setModal(null)}
              aria-label="Close"
              className="rounded-md p-1 text-[#94A3B8] hover:text-[#102A56] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#062B67]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
            {otpSent ? "Enter the six-digit code sent to your email address." : "We will email a one-time sign-in code to your registered account."}
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (otpSent) void verifyEmailCode();
              else void requestEmailCode();
            }}
          >
            <label htmlFor="otp-email" className="block text-sm font-semibold text-[#102A56]">Email address</label>
            <input id="otp-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-lg border border-[#D7E0EC] px-3 text-sm text-[#102A56] outline-none focus:border-[#062B67] focus:ring-2 focus:ring-[#062B67]/15" />
            {otpSent && <OtpBoxes value={otpCode} onChange={setOtpCode} />}
            {otpNote && <p role="status" className="rounded-lg border border-[#D7E0EC] bg-[#F5F8FC] px-3 py-2 text-xs text-[#43536D]">{otpNote}</p>}
            <button type="submit" disabled={otpLoading || (otpSent && otpCode.length !== 6)} className="h-11 w-full rounded-[10px] bg-[#062B67] text-sm font-bold text-white disabled:opacity-60">
              {otpLoading ? "Please wait…" : otpSent ? "Verify and sign in" : "Send sign-in code"}
            </button>
            {otpSent && (
              <button type="button" disabled={otpLoading || otpSeconds > 0} onClick={() => void requestEmailCode()} className="w-full text-sm font-semibold text-[#2563EB] disabled:text-slate-400">
                {otpSeconds > 0 ? `Resend code in ${otpSeconds}s` : "Resend sign-in code"}
              </button>
            )}
          </form>
        </Modal>
      )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-200/70" />}
    >
      <LoginForm />
    </React.Suspense>
  );
}
