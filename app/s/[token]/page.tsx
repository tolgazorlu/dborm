import { redirect } from "next/navigation";

import ShareReveal from "@/components/share/share-reveal";
import { AUTH_ENABLED } from "@/lib/auth/config";
import { isSignedIn } from "@/lib/auth/session";
import { operator } from "@/lib/legal/operator";
import { peekShare } from "@/lib/share/store";

export const metadata = {
  title: "One-time schema link — ORMLens",
  robots: { index: false, follow: false },
};

export default async function SharePage({ params }: PageProps<"/s/[token]">) {
  if (AUTH_ENABLED && !(await isSignedIn())) redirect("/login");

  const { token } = await params;
  const meta = await peekShare(token);

  return (
    <ShareReveal token={token} expiresAt={meta?.expiresAt ?? null} showSignOut={AUTH_ENABLED}
      showLegal={operator().configured}
    />
  );
}
