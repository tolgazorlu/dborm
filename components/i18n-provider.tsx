"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { DICTIONARIES, type Dictionary } from "@/lib/i18n/dictionary";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/locales";

interface I18nContextValue {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Dil tercihi çerezde tutuluyor — temanın aksine.
 *
 * Tema bir öznitelik olduğu için satır içi script ile düzeltilebiliyordu; dil
 * ise metnin kendisini değiştirir. `localStorage`'tan okunsaydı sunucunun
 * ürettiği HTML ile istemcinin ürettiği metin uyuşmaz, her metin düğümünde
 * hydration hatası olurdu. Çerez, istekle birlikte sunucuya gittiği için
 * sunucu doğru dilde render edebiliyor: uyuşmazlık da yok, geçiş anı da yok.
 */
export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, t: DICTIONARIES[locale], setLocale }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n, I18nProvider içinde kullanılmalı.");
  return context;
}
