import { useSyncExternalStore } from "react";

/**
 * Zaman damgasını kullanıcının yerel biçiminde gösterir — hydration hatası
 * üretmeden.
 *
 * `toLocaleString` sonucu çalıştığı ortamın saat dilimine ve ICU sürümüne
 * bağlıdır. Sunucuda (çoğu üretim ortamında TZ=UTC) ve tarayıcıda farklı metin
 * çıkar; SSR edilen bir metin düğümünde bu doğrudan hydration uyuşmazlığıdır.
 *
 * Çözüm: hydration bitene kadar her iki tarafta da **aynı** deterministik UTC
 * metnini ver, yerel biçime ondan sonra geç. `useSyncExternalStore`'un sunucu
 * anlık görüntüsü tam olarak bunu ifade eder — effect içinde setState çağırıp
 * fazladan render tetiklemeye gerek kalmaz.
 */
const subscribe = () => () => {};
const isHydrated = () => true;
const isServer = () => false;

export function useLocalDateTime(value: number | null | undefined, locale: string): string {
  const hydrated = useSyncExternalStore(subscribe, isHydrated, isServer);

  if (!value) return "";
  return hydrated ? new Date(value).toLocaleString(locale) : utcFallback(value);
}

/** Saat diliminden bağımsız, sunucu ve istemcide birebir aynı çıktı. */
function utcFallback(value: number): string {
  return `${new Date(value).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
