"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import Workspace from "@/components/workspace";
import { useLocalDateTime } from "@/lib/hooks/use-local-datetime";
import type { OrmId } from "@/lib/orm/types";

export interface ShareRevealProps {
  token: string;
  /** Sunucudaki kontrolün sonucu; null ise link zaten yok ya da süresi dolmuş. */
  expiresAt: number | null;
}

interface Payload {
  orm: OrmId;
  sources: Record<string, string>;
}

export default function ShareReveal({ token, expiresAt }: ShareRevealProps) {
  const { t, locale } = useI18n();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(expiresAt ? null : t.reveal.gone);
  // Sunucu ile istemcinin saat dilimi farkı hydration hatası üretmesin diye
  // yerel biçimlendirme mount'tan sonra yapılıyor.
  const expiryText = useLocalDateTime(expiresAt, locale);

  const reveal = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/share/${token}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? t.reveal.failed);
      setPayload(data as Payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.reveal.failed);
    } finally {
      setIsLoading(false);
    }
  }, [token, t.reveal.failed]);

  if (payload) {
    return <Workspace initialOrm={payload.orm} initialSources={payload.sources} />;
  }

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden="true">
              <path d="M10 2a4 4 0 0 0-4 4v2H5.5A1.5 1.5 0 0 0 4 9.5v7A1.5 1.5 0 0 0 5.5 18h9a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 8H14V6a4 4 0 0 0-4-4Zm2 6H8V6a2 2 0 1 1 4 0v2Z" />
            </svg>
          </span>
          <h1 className="text-sm font-semibold text-fg">{t.reveal.title}</h1>
        </div>

        {error ? (
          <>
            <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">{error}</p>
            <Link
              href="/"
              className="mt-4 inline-flex rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
            >
              {t.reveal.start}
            </Link>
          </>
        ) : (
          <>
            <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">{t.reveal.body}</p>
            {expiresAt ? (
              <p className="mt-2 text-[11px] text-fg-faint">
                {t.reveal.expiresAt(expiryText)}
              </p>
            ) : null}
            <button
              type="button"
              onClick={reveal}
              disabled={isLoading}
              className="mt-4 w-full rounded-md bg-accent px-3 py-2.5 text-xs font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? t.reveal.opening : t.reveal.open}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
