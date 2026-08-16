"use client";

import { useI18n } from "@/components/i18n-provider";
import type { Finding } from "@/lib/analysis/types";
import type { ParseDiagnostic } from "@/lib/orm/types";
import FindingCard from "./finding-card";

export interface ChecksPanelProps {
  findings: Finding[];
  diagnostics: ParseDiagnostic[];
  onHover?: (table: string | null, columns: string[]) => void;
}

const DIAGNOSTIC_TOKEN: Record<ParseDiagnostic["level"], string> = {
  error: "critical",
  warning: "medium",
  info: "info",
};

/**
 * AI'dan bağımsız çalışan panel: kural motoru + parser teşhisleri.
 * Anahtar olmadan da uygulamanın işe yaramasını sağlar.
 */
export default function ChecksPanel({ findings, diagnostics, onHover }: ChecksPanelProps) {
  const { t } = useI18n();

  return (
    <div className="pane-scroll min-h-0 flex-1 space-y-2 p-3">
      {diagnostics.length > 0 ? (
        <section className="space-y-1.5">
          <h2 className="px-0.5 text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
            {t.panel.parseSection(diagnostics.length)}
          </h2>
          {diagnostics.map((diagnostic, index) => {
            const token = DIAGNOSTIC_TOKEN[diagnostic.level];
            return (
              <p
                key={`${diagnostic.message}-${index}`}
                className="rounded-lg border p-2.5 text-[11.5px] leading-relaxed"
                style={{
                  borderColor: `var(--sev-${token})`,
                  background: `var(--sev-${token}-bg)`,
                  color: `var(--sev-${token})`,
                }}
              >
                {diagnostic.message}
                {diagnostic.file ? (
                  <span className="ml-1 font-mono text-[10px] opacity-70">
                    {diagnostic.file}
                    {diagnostic.line ? `:${diagnostic.line}` : ""}
                  </span>
                ) : null}
              </p>
            );
          })}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="px-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-fg-faint">
          {t.panel.rulesSection(findings.length)}
        </h2>
        {findings.map((finding) => (
          <FindingCard key={finding.id} finding={finding} onHover={onHover} />
        ))}
        {findings.length === 0 ? (
          <p className="px-1 py-6 text-center text-[11.5px] text-fg-faint">{t.panel.allClear}</p>
        ) : null}
      </section>
    </div>
  );
}
