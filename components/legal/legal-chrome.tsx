"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useI18n } from "@/components/i18n-provider";
import LocaleToggle from "@/components/locale-toggle";
import Wordmark from "@/components/ui/wordmark";
import ThemeToggle from "@/components/theme-toggle";

const LINKS = [
  { href: "/legal/privacy", key: "privacy" as const },
  { href: "/legal/kvkk", key: "kvkk" as const },
  { href: "/legal/cookies", key: "cookies" as const },
];

export default function LegalChrome({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg text-fg">
      <header className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-4 py-2">
        <Link href="/" className="whitespace-nowrap text-sm font-semibold tracking-tight">
          <Wordmark />
        </Link>
        <span className="text-[11px] text-fg-faint">{t.legal.title}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/"
            className="rounded-md border border-line px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {t.legal.back}
          </Link>
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </header>

      <div className="pane-scroll min-h-0 flex-1">
        <div className="mx-auto w-full max-w-3xl px-5 py-8">
          <nav className="mb-6 flex flex-wrap gap-1.5">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  pathname === link.href
                    ? "border-line-strong bg-surface-2 text-fg"
                    : "border-line text-fg-faint hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {t.legal[link.key]}
              </Link>
            ))}
          </nav>
          <article className="legal-prose">{children}</article>
        </div>
      </div>
    </div>
  );
}
