"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n-provider";

export default function SignOutButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);

  const signOut = useCallback(async () => {
    setIsBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }, [router]);

  return (
    <button type="button" onClick={signOut} disabled={isBusy} className={className}>
      {t.auth.signOut}
    </button>
  );
}
