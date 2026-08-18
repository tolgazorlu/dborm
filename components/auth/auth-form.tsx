"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";

import { useI18n } from "@/components/i18n-provider";

export interface AuthFormProps {
  mode: "setup" | "login";
  requiresSetupToken: boolean;
  minPasswordLength: number;
}

export default function AuthForm({ mode, requiresSetupToken, minPasswordLength }: AuthFormProps) {
  const { t } = useI18n();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const isSetup = mode === "setup";

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError(null);

      if (isSetup && password !== confirm) {
        setError(t.auth.passwordMismatch);
        return;
      }

      setIsBusy(true);
      try {
        const response = await fetch(isSetup ? "/api/auth/setup" : "/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isSetup && requiresSetupToken ? { email, password, token } : { email, password },
          ),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? t.auth.failed);

        router.replace("/");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t.auth.failed);
        setIsBusy(false);
      }
    },
    [isSetup, requiresSetupToken, email, password, confirm, token, router, t.auth],
  );

  const field =
    "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-fg outline-none transition-colors focus:border-accent";

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-fg-muted">{t.auth.email}</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          required
          className={field}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-fg-muted">{t.auth.password}</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={isSetup ? "new-password" : "current-password"}
          minLength={isSetup ? minPasswordLength : undefined}
          required
          className={field}
        />
        {isSetup ? (
          <span className="mt-1 block text-[11px] text-fg-faint">
            {t.auth.passwordHint(minPasswordLength)}
          </span>
        ) : null}
      </label>

      {isSetup ? (
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-fg-muted">
            {t.auth.passwordConfirm}
          </span>
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            required
            className={field}
          />
        </label>
      ) : null}

      {isSetup && requiresSetupToken ? (
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-fg-muted">
            {t.auth.setupToken}
          </span>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
            className={field}
          />
        </label>
      ) : null}

      {error ? (
        <p
          className="rounded-lg border p-3 text-[11.5px] leading-relaxed"
          style={{
            borderColor: "var(--sev-critical)",
            background: "var(--sev-critical-bg)",
            color: "var(--sev-critical)",
          }}
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isBusy}
        className="w-full rounded-md bg-accent px-3 py-2.5 text-xs font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isBusy
          ? isSetup
            ? t.auth.creating
            : t.auth.signingIn
          : isSetup
            ? t.auth.createAccount
            : t.auth.signIn}
      </button>
    </form>
  );
}
