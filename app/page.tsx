import { redirect } from "next/navigation";

import Workspace from "@/components/workspace";
import { AUTH_ENABLED } from "@/lib/auth/config";
import { isSignedIn } from "@/lib/auth/session";
import { operator } from "@/lib/legal/operator";

export default async function Home() {
  if (AUTH_ENABLED && !(await isSignedIn())) redirect("/login");

  return <Workspace showSignOut={AUTH_ENABLED} showLegal={operator().configured} />;
}
