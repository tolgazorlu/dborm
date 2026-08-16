import ShareReveal from "@/components/share/share-reveal";
import { peekShare } from "@/lib/share/store";

export const metadata = {
  title: "Tek kullanımlık şema linki — ORMLens",
  // Paylaşılan şema arama motorlarına düşmesin.
  robots: { index: false, follow: false },
};

/**
 * Sunucuda yalnızca "bu link hâlâ geçerli mi" sorusu yanıtlanıyor; içerik
 * okunmuyor. Tüketme işlemi kullanıcının tıklamasıyla POST üzerinden oluyor
 * (bkz. app/api/share/[token]/route.ts).
 */
export default async function SharePage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const meta = await peekShare(token);

  return <ShareReveal token={token} expiresAt={meta?.expiresAt ?? null} />;
}
