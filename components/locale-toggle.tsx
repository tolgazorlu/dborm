"use client";

import { useI18n } from "@/components/i18n-provider";
import { LOCALES } from "@/lib/i18n/locales";

export default function LocaleToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className="flex shrink-0 overflow-hidden rounded-md border border-line"
      role="group"
      aria-label={t.header.language}
    >
      {LOCALES.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLocale(item)}
          aria-pressed={locale === item}
          className={`px-1.5 py-1 text-[10px] font-semibold uppercase transition-colors ${
            locale === item
              ? "bg-surface-2 text-fg"
              : "text-fg-faint hover:bg-surface-2 hover:text-fg"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
