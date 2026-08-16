"use client";

import { useI18n } from "@/components/i18n-provider";
import type { FindingCategory, Severity } from "@/lib/analysis/types";

/**
 * Akış (streaming) sırasında AI bulgusunun her alanı henüz gelmemiş olabilir;
 * bu yüzden tüm alanlar gevşek tipli. Aynı kart hem statik kural motorunun
 * tamamlanmış bulgularını hem de yarım gelen AI bulgularını render eder.
 */
export interface FindingLike {
  id?: string;
  severity?: Severity | null;
  category?: string | null;
  title?: string | null;
  table?: string | null;
  columns?: (string | undefined)[] | null;
  description?: string | null;
  suggestion?: string | null;
  codeFix?: string | null;
}

export interface FindingCardProps {
  finding: FindingLike;
  onHover?: (table: string | null, columns: string[]) => void;
}

export default function FindingCard({ finding, onHover }: FindingCardProps) {
  const { t } = useI18n();
  const severity: Severity = finding.severity ?? "info";
  const columns = (finding.columns ?? []).filter((column): column is string => Boolean(column));
  const category = finding.category
    ? (t.category[finding.category as FindingCategory] ?? finding.category)
    : null;

  return (
    <article
      className="rounded-lg border border-line bg-surface-2 p-3 transition-colors hover:border-line-strong"
      onMouseEnter={() => onHover?.(finding.table ?? null, columns)}
      onMouseLeave={() => onHover?.(null, [])}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Renkler CSS değişkenlerinden gelir; iki tema için ayrı sınıf yazmaya gerek kalmaz. */}
        <span
          className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
          style={{ background: `var(--sev-${severity}-bg)`, color: `var(--sev-${severity})` }}
        >
          {t.severity[severity] ?? severity}
        </span>
        {category ? (
          <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-fg-muted">
            {category}
          </span>
        ) : null}
        {finding.table ? (
          <span className="font-mono text-[10px] text-accent">
            {finding.table}
            {columns.length > 0 ? `.${columns.join(", .")}` : ""}
          </span>
        ) : null}
      </div>

      {finding.title ? (
        <h3 className="mt-1.5 text-[12.5px] font-semibold leading-snug text-fg">{finding.title}</h3>
      ) : (
        <div className="mt-1.5 h-3 w-2/3 animate-pulse rounded bg-surface-3" />
      )}

      {finding.description ? (
        <p className="mt-1 text-[11.5px] leading-relaxed text-fg-muted">{finding.description}</p>
      ) : null}

      {finding.suggestion ? (
        <p
          className="mt-1.5 border-l-2 pl-2 text-[11.5px] leading-relaxed"
          style={{ borderColor: "var(--ok)", color: "var(--ok)" }}
        >
          {finding.suggestion}
        </p>
      ) : null}

      {finding.codeFix ? (
        <pre className="mt-2 overflow-x-auto rounded border border-line bg-surface p-2 font-mono text-[10.5px] leading-relaxed text-fg-muted">
          <code>{finding.codeFix}</code>
        </pre>
      ) : null}
    </article>
  );
}
