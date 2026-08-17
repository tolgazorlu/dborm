/**
 * İstek gövdesini **sınırlı** okur.
 *
 * App Router'ın route handler'larında gövde boyutu için yerleşik bir tavan yok
 * (Pages Router'daki `bodyParser.sizeLimit` karşılığı bulunmuyor). `await
 * request.json()` çağrısı gövdeyi sonuna kadar belleğe alır: tek bir istek
 * gigabaytlarca veri gönderip süreci düşürebilir.
 *
 * Burada akış elle okunuyor ve tavan aşılır aşılmaz iptal ediliyor.
 * `content-length` ön kontrolü sadece hızlı yol: başlık yalan söyleyebilir ya
 * da chunked gövdede hiç bulunmayabilir, asıl güvence sayaçtır.
 */

/** Kullanıcı kodunun (tüm sekmeler toplamı) üst sınırı. */
export const MAX_SOURCE_BYTES = 256 * 1024;

/** JSON kaçış karakterleri ve alan adları için pay bırakılmış gövde tavanı. */
export const MAX_BODY_BYTES = 512 * 1024;

export type BodyResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too-large" | "invalid" };

export async function readLimitedJson(
  request: Request,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<BodyResult> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, reason: "too-large" };
  }

  const body = request.body;
  if (!body) return { ok: false, reason: "invalid" };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(buffer)) };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
