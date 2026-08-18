"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import IconButton from "@/components/ui/icon-button";
import { SignOutIcon } from "@/components/ui/icons";

export default function SignOutButton() {
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
    <IconButton label={t.auth.signOut} onClick={signOut} disabled={isBusy}>
      <SignOutIcon />
    </IconButton>
  );
}
