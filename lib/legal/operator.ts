export interface Operator {
  name: string;
  contact: string;
  address: string;
  configured: boolean;
}

const PLACEHOLDER_NAME = "[operator name]";
const PLACEHOLDER_CONTACT = "[contact email]";

export function operator(): Operator {
  const name = process.env.LEGAL_ENTITY?.trim();
  const contact = process.env.LEGAL_CONTACT?.trim();
  const address = process.env.LEGAL_ADDRESS?.trim();

  return {
    name: name || PLACEHOLDER_NAME,
    contact: contact || PLACEHOLDER_CONTACT,
    address: address || "",
    configured: Boolean(name && contact),
  };
}

export const LAST_UPDATED = "2026-08-18";

export function analyticsEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID);
}

export function aiProviderName(): string {
  return process.env.AI_PROVIDER_NAME?.trim() || "Google (Gemini API)";
}
