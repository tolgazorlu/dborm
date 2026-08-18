"use client";

import { useCallback, useEffect, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { useLocalDateTime } from "@/lib/hooks/use-local-datetime";
import type { OrmId } from "@/lib/orm/types";

export interface ShareDialogProps {
  orm: OrmId;
  sources: Record<string, string>;
}

interface ShareResult {
  url: string;
  expiresAt: number;
}

export default function ShareDialog({ orm, sources }: ShareDialogProps) {
  const { t, locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<ShareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const expiryText = useLocalDateTime(result?.expiresAt, locale);

  const close = useCallback(() => {
    setIsOpen(false);
    setResult(null);
    setError(null);
    setIsCopied(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  const create = useCallback(async () => {
    setIsOpen(true);
    setIsLoading(true);
    setError(null);
    setResult(null);
    setIsCopied(false);

    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orm, sources, locale }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
      setResult({ url: data.url, expiresAt: data.expiresAt });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.share.failed);
    } finally {
      setIsLoading(false);
    }
  }, [orm, sources, locale, t.share.failed]);

  const copy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setError(t.share.copyFailed);
    }
  }, [result, t.share.copyFailed]);

  return (
    <>
      <button
        type="button"
        onClick={create}
        className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <svg viewBox="0 0 20 20" className="size-3" fill="currentColor" aria-hidden="true">
          <path d="M12.6 3.4a3.3 3.3 0 0 1 4.7 4.7l-2.3 2.3a1 1 0 0 1-1.4-1.4l2.3-2.3a1.3 1.3 0 0 0-1.9-1.9l-2.3 2.3a1 1 0 1 1-1.4-1.4l2.3-2.3Zm-5.2 5.2a1 1 0 0 1 1.4 1.4l-2.3 2.3a1.3 1.3 0 0 0 1.9 1.9l2.3-2.3a1 1 0 0 1 1.4 1.4l-2.3 2.3a3.3 3.3 0 1 1-4.7-4.7l2.3-2.3Zm4.9-.5a1 1 0 0 1 0 1.4l-3 3a1 1 0 1 1-1.4-1.4l3-3a1 1 0 0 1 1.4 0Z" />
        </svg>
        {t.header.share}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t.share.title}
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-fg">{t.share.title}</h2>
                <p className="mt-1 text-[11.5px] leading-relaxed text-fg-muted">
                  {t.share.description}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label={t.share.close}
                className="rounded p-1 text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden="true">
                  <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" />
                </svg>
              </button>
            </div>

            {isLoading ? (
              <p className="mt-4 text-[12px] text-fg-muted">{t.share.creating}</p>
            ) : null}

            {error ? (
              <p
                className="mt-4 rounded-lg border p-3 text-[11.5px] leading-relaxed"
                style={{
                  borderColor: "var(--sev-critical)",
                  background: "var(--sev-critical-bg)",
                  color: "var(--sev-critical)",
                }}
              >
                {error}
              </p>
            ) : null}

            {result ? (
              <>
                <div className="mt-4 flex items-center gap-2">
                  <input
                    readOnly
                    value={result.url}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2.5 py-2 font-mono text-[11px] text-fg outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={copy}
                    className="shrink-0 rounded-md bg-accent px-3 py-2 text-[11px] font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
                  >
                    {isCopied ? t.share.copied : t.share.copy}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-fg-faint">
                  {t.share.expiresAt(expiryText)}
                </p>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
