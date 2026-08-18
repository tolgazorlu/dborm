import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const isHydrated = () => true;
const isServer = () => false;

export function useLocalDateTime(value: number | null | undefined, locale: string): string {
  const hydrated = useSyncExternalStore(subscribe, isHydrated, isServer);

  if (!value) return "";
  return hydrated ? new Date(value).toLocaleString(locale) : utcFallback(value);
}

function utcFallback(value: number): string {
  return `${new Date(value).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
