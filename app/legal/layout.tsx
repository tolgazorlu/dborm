import type { ReactNode } from "react";

import LegalChrome from "@/components/legal/legal-chrome";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return <LegalChrome>{children}</LegalChrome>;
}
