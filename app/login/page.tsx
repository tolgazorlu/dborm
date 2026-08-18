import { redirect } from "next/navigation";

import AuthForm from "@/components/auth/auth-form";
import AuthIntro from "@/components/auth/auth-intro";
import { AUTH_ENABLED, setupToken } from "@/lib/auth/config";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { currentSession } from "@/lib/auth/session";
import { accountExists } from "@/lib/auth/store";

export const metadata = {
  title: "Sign in — ORMLens",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (!AUTH_ENABLED) redirect("/");
  if (await currentSession()) redirect("/");

  const mode = (await accountExists()) ? "login" : "setup";

  return (
    <main className="flex min-h-0 flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-lg">
        <AuthIntro mode={mode} />
        <AuthForm
          mode={mode}
          requiresSetupToken={mode === "setup" && setupToken() !== null}
          minPasswordLength={MIN_PASSWORD_LENGTH}
        />
      </div>
    </main>
  );
}
