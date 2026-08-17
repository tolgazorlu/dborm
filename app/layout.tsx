import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";

import Clarity from "@/components/analytics/clarity";
import { I18nProvider } from "@/components/i18n-provider";
import InlineScript from "@/components/inline-script";
import { ThemeProvider } from "@/components/theme-provider";
import { LOCALE_COOKIE, toLocale } from "@/lib/i18n/locales";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ORMLens — ORM şema görselleştirici",
  description:
    "Drizzle, Prisma ve Mongoose şemalarını canlı ER diyagramına çevirin; index, ilişki ve güvenlik analizini yapay zekâdan alın.",
};

/**
 * Tema, HTML ayrıştırılırken senkron çalışan bu script ile ilk boyamadan önce
 * `<html data-theme>` üzerine yazılıyor. Sunucu "dark" ile render ettiği için
 * `suppressHydrationWarning` gerekiyor: DOM'daki değer kazanır.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Dil çerezden okunuyor: sunucu doğru dilde render edebilsin ve metinlerde
  // hydration uyuşmazlığı olmasın (bkz. components/i18n-provider.tsx).
  const cookieStore = await cookies();
  const locale = toLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  // CSP nonce'u `proxy.ts` üretiyor; satır içi tema script'inin çalışabilmesi
  // için etikete taşınması gerekiyor.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <InlineScript html={THEME_SCRIPT} nonce={nonce} />
      </head>
      <body className="flex h-full flex-col overflow-hidden">
        <I18nProvider initialLocale={locale}>
          <ThemeProvider>{children}</ThemeProvider>
        </I18nProvider>
        <Clarity nonce={nonce} />
      </body>
    </html>
  );
}
