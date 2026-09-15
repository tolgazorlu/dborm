"use client";

import { useObject } from "@ai-sdk/react";
import { useMemo, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { analysisSchema } from "@/lib/ai/analysis-schema";
import { detectHosting, type HostingKind } from "@/lib/ai/hosting";
import type { OrmId } from "@/lib/orm/types";
import FindingCard from "./finding-card";

function readableError(error: Error, fallback: string): string {
  if (process.env.NODE_ENV !== "development") return fallback;

  try {
    const parsed = JSON.parse(error.message);
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {}
  return error.message;
}

export interface AnalysisPanelProps {
  orm: OrmId;
  sources: Record<string, string>;
  disabled: boolean;
  onHover?: (table: string | null, columns: string[]) => void;
}

export default function AnalysisPanel({ orm, sources, disabled, onHover }: AnalysisPanelProps) {
  const { t, locale } = useI18n();
  const { object, submit, stop, isLoading, error } = useObject({
    api: "/api/analyze",
    schema: analysisSchema,
  });

  const [hosting, setHosting] = useState<HostingKind>("unknown");

  // The same detection the server runs, so the panel can show what the pasted
  // files gave away before the review is even started.
  const detected = useMemo(
    () => detectHosting(Object.entries(sources).map(([path, content]) => ({ path, content }))),
    [sources],
  );

  const findings = object?.findings ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-line p-3">
        <label className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] text-fg-muted">{t.ai.deployment}</span>
          <select
            value={hosting}
            onChange={(event) => setHosting(event.target.value as HostingKind)}
            className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] text-fg outline-none transition-colors hover:bg-surface-3 focus:border-accent"
          >
            <option value="unknown">{t.ai.deploymentAuto}</option>
            <option value="serverless">{t.ai.deploymentServerless}</option>
            <option value="self-hosted">{t.ai.deploymentSelfHosted}</option>
          </select>
        </label>

        {hosting === "unknown" ? (
          <p className="text-[10.5px] leading-relaxed text-fg-faint">
            {detected.evidence.length > 0
              ? t.ai.deploymentDetected(detected.evidence.join(", "))
              : t.ai.deploymentUnknown}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => submit({ orm, sources, locale, hosting })}
            disabled={disabled || isLoading}
            className="flex-1 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-faint"
          >
            {isLoading ? t.ai.analyzing : t.ai.analyze}
          </button>
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="rounded-md border border-line px-3 py-2 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {t.ai.stop}
            </button>
          ) : null}
        </div>
      </div>

      <div className="pane-scroll min-h-0 flex-1 space-y-2 p-3">
        {error ? (
          <p
            className="rounded-lg border p-3 text-[11.5px] leading-relaxed"
            style={{
              borderColor: "var(--sev-critical)",
              background: "var(--sev-critical-bg)",
              color: "var(--sev-critical)",
            }}
          >
            {readableError(error, t.ai.limitReached)}
          </p>
        ) : null}

        {object?.healthScore !== undefined && object.healthScore !== null ? (
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] uppercase tracking-wide text-fg-faint">
                {t.ai.health}
              </span>
              <span className="text-lg font-bold text-fg">
                {Math.round(object.healthScore)}/100
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, object.healthScore))}%`,
                  background: "linear-gradient(90deg, var(--accent), var(--ok))",
                }}
              />
            </div>
            {object.summary ? (
              <p className="mt-2 text-[11.5px] leading-relaxed text-fg-muted">{object.summary}</p>
            ) : null}
          </div>
        ) : null}

        {findings.map((finding, index) => (
          <FindingCard key={finding?.id ?? index} finding={finding ?? {}} onHover={onHover} />
        ))}

        {!isLoading && !error && findings.length === 0 ? (
          <p className="px-1 py-8 text-center text-[11.5px] leading-relaxed text-fg-faint">
            {t.ai.empty}
          </p>
        ) : null}
      </div>
    </div>
  );
}
