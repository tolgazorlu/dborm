import { ORM_CATALOG, isOrmId } from "@/lib/orm/catalog";
import { ORM_IDS, type OrmId } from "@/lib/orm/types";

/**
 * Çalışma alanının tarayıcıda saklanması.
 *
 * **Neden `localStorage`, çerez değil?** Çerez her HTTP isteğiyle birlikte
 * sunucuya gider ve pratikte ~4 KB ile sınırlıdır; buradaki içerik ise
 * kullanıcının şema kodu — 256 KB'a kadar çıkabiliyor. Çerezde tutmak hem
 * teknik olarak imkânsız hem de gereksiz: sunucunun bu veriye ihtiyacı yok,
 * her istekte tekrar tekrar yollanması sadece bant genişliği ve sunucu
 * günlüklerine sızan veri demek olurdu. `localStorage` istemcide kalır,
 * boyut sınırı çok daha yüksektir ve sekme kapansa bile korunur.
 *
 * (Dil tercihi bunun tam tersi bir sebeple çerezde: onu **sunucunun** ilk
 * render'da bilmesi gerekiyor — bkz. `components/i18n-provider.tsx`.)
 *
 * Okunan veri her zaman doğrulanır: anahtar kullanıcının (ya da aynı alan
 * adındaki başka bir script'in) elle değiştirebileceği bir yer, bu yüzden
 * gelen içerik "güvenilmez girdi" muamelesi görüyor.
 */

const STORAGE_KEY = "ormlens:workspace:v1";

/** Sunucudaki girdi sınırıyla aynı; daha fazlası zaten ayrıştırılamaz. */
const MAX_STORED_BYTES = 256 * 1024;

export interface StoredWorkspace {
  orm: OrmId;
  sources: Record<OrmId, Record<string, string>>;
}

export function readWorkspace(): StoredWorkspace | null {
  if (typeof window === "undefined") return null;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Gizli sekme / kapatılmış depolama: kalıcılık olmadan devam.
    return null;
  }
  if (!raw) return null;

  try {
    return sanitize(JSON.parse(raw));
  } catch {
    // Bozuk kayıt kullanıcıyı sonsuza dek boş ekranda bırakmasın.
    clearWorkspace();
    return null;
  }
}

export function writeWorkspace(value: StoredWorkspace): void {
  if (typeof window === "undefined") return;

  const serialized = JSON.stringify(value);
  if (serialized.length > MAX_STORED_BYTES) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Kota dolduysa ya da depolama yasaklıysa sessizce vazgeç: kalıcılık
    // konfor özelliği, uygulamanın çalışması buna bağlı değil.
  }
}

export function clearWorkspace(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // yoksay
  }
}

/**
 * Yalnızca kataloğun tanıdığı ORM ve dosya anahtarlarını, yalnızca string
 * değerlerle geri verir. Bilinmeyen her şey düşer; hiçbir şey kalmazsa `null`.
 */
function sanitize(value: unknown): StoredWorkspace | null {
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const rawSources = record.sources;
  if (typeof rawSources !== "object" || rawSources === null) return null;

  const sources = {} as Record<OrmId, Record<string, string>>;
  let hasContent = false;

  for (const orm of ORM_IDS) {
    const stored = (rawSources as Record<string, unknown>)[orm];
    const files: Record<string, string> = {};

    if (typeof stored === "object" && stored !== null) {
      for (const file of ORM_CATALOG[orm].files) {
        const content = (stored as Record<string, unknown>)[file.key];
        if (typeof content === "string") {
          files[file.key] = content;
          hasContent = true;
        }
      }
    }
    sources[orm] = files;
  }

  if (!hasContent) return null;

  return { orm: isOrmId(record.orm) ? record.orm : ORM_IDS[0], sources };
}
