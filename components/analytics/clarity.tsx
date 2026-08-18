"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { readConsent, writeConsent, type ConsentValue } from "./consent";

const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

const CLARITY_SNIPPET = `(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`;

export default function Clarity({ nonce }: { nonce?: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentValue | null>(null);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setIsResolved(true);
  }, []);

  const decide = useCallback((value: ConsentValue) => {
    writeConsent(value);
    setConsent(value);
  }, []);

  if (!CLARITY_PROJECT_ID) return null;
  if (process.env.NODE_ENV === "development") return null;
  if (pathname.startsWith("/s/") || pathname.startsWith("/legal")) return null;
  if (!isResolved) return null;

  if (consent === "granted") {
    return (
      <Script id="ms-clarity" nonce={nonce} strategy="afterInteractive">
        {CLARITY_SNIPPET}
      </Script>
    );
  }

  if (consent === "denied") return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-xl border border-line bg-surface p-4 shadow-2xl">
      <p className="text-[12px] leading-relaxed text-fg-muted">{t.consent.body}</p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => decide("granted")}
          className="rounded-md bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
        >
          {t.consent.accept}
        </button>
        <button
          type="button"
          onClick={() => decide("denied")}
          className="rounded-md border border-line px-3 py-1.5 text-[11px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          {t.consent.decline}
        </button>
        <a
          href="/legal/cookies"
          className="ml-auto text-[11px] text-fg-faint underline underline-offset-2 hover:text-fg"
        >
          {t.consent.more}
        </a>
      </div>
    </div>
  );
}
