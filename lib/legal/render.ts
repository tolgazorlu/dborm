import { cookies } from "next/headers";

import { DICTIONARIES } from "@/lib/i18n/dictionary";
import { LOCALE_COOKIE, toLocale } from "@/lib/i18n/locales";
import { buildDocument, type LegalKind } from "./document";
import { LAST_UPDATED, operator } from "./operator";
import type { LegalDocument } from "./types";

export interface RenderedLegal {
  document: LegalDocument;
  updatedLabel: string;
  unconfiguredNote: string | null;
}

export async function renderLegal(kind: LegalKind): Promise<RenderedLegal> {
  const store = await cookies();
  const locale = toLocale(store.get(LOCALE_COOKIE)?.value);
  const t = DICTIONARIES[locale];

  return {
    document: buildDocument(kind, locale),
    updatedLabel: t.legal.updated(LAST_UPDATED),
    unconfiguredNote: operator().configured ? null : t.legal.unconfigured,
  };
}
