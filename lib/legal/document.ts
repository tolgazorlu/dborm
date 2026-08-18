import { AUTH_ENABLED } from "@/lib/auth/config";
import type { Locale } from "@/lib/i18n/locales";
import { cookieDocument } from "./cookies";
import { kvkkDocument } from "./kvkk";
import { aiProviderName, analyticsEnabled, operator } from "./operator";
import { privacyDocument } from "./privacy";
import type { DocumentInput, LegalDocument } from "./types";

export type LegalKind = "privacy" | "kvkk" | "cookies";

export function buildDocument(kind: LegalKind, locale: Locale): LegalDocument {
  const current = operator();
  const input: DocumentInput = {
    operatorName: current.name,
    contact: current.contact,
    address: current.address,
    analyticsEnabled: analyticsEnabled(),
    authEnabled: AUTH_ENABLED,
    aiProvider: aiProviderName(),
  };

  switch (kind) {
    case "kvkk":
      return kvkkDocument(input, locale);
    case "cookies":
      return cookieDocument(input, locale);
    default:
      return privacyDocument(input, locale);
  }
}
