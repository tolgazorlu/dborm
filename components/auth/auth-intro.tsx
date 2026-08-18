"use client";

import { useI18n } from "@/components/i18n-provider";
import Wordmark from "@/components/ui/wordmark";

export default function AuthIntro({ mode }: { mode: "setup" | "login" }) {
  const { t } = useI18n();
  const isSetup = mode === "setup";

  return (
    <>
      <Wordmark className="text-sm font-semibold text-fg" />
      <h2 className="mt-3 text-[15px] font-semibold text-fg">
        {isSetup ? t.auth.setupTitle : t.auth.loginTitle}
      </h2>
      <p className="mt-2 text-[12.5px] leading-relaxed text-fg-muted">
        {isSetup ? t.auth.setupBody : t.auth.loginBody}
      </p>
      {isSetup ? (
        <p
          className="mt-3 rounded-lg border p-3 text-[11.5px] leading-relaxed"
          style={{
            borderColor: "var(--sev-high, var(--sev-critical))",
            background: "var(--sev-critical-bg)",
            color: "var(--sev-critical)",
          }}
        >
          {t.auth.setupWarning}
        </p>
      ) : null}
    </>
  );
}
