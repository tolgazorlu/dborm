export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CATEGORIES = [
  "index",
  "relation",
  "performance",
  "security",
  "naming",
  "data-integrity",
  "scalability",
] as const;
export type FindingCategory = (typeof CATEGORIES)[number];

/** Hem statik kural motorunun hem de AI'ın ürettiği bulguların ortak şekli. */
export interface Finding {
  id: string;
  severity: Severity;
  category: FindingCategory;
  title: string;
  /** İlgili tablonun değişken adı (varsa) */
  table?: string;
  /** İlgili kolonların obje anahtarları */
  columns?: string[];
  description: string;
  suggestion: string;
  /** Uygulanabilir Drizzle kod parçası */
  codeFix?: string;
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function sortFindings<T extends { severity?: Severity | null }>(findings: T[]): T[] {
  return [...findings].sort(
    (a, b) =>
      (a.severity ? SEVERITY_ORDER[a.severity] : 99) - (b.severity ? SEVERITY_ORDER[b.severity] : 99),
  );
}
