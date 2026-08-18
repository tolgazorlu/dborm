import ShareReveal from "@/components/share/share-reveal";
import { peekShare } from "@/lib/share/store";

export const metadata = {
  title: "One-time schema link — ORMLens",
  robots: { index: false, follow: false },
};

export default async function SharePage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const meta = await peekShare(token);

  return <ShareReveal token={token} expiresAt={meta?.expiresAt ?? null} />;
}
