"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

const CLARITY_PROJECT_ID = "y38g8fuokb";

const CLARITY_SNIPPET = `(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`;

export default function Clarity({ nonce }: { nonce?: string }) {
  const pathname = usePathname();

  if (process.env.NODE_ENV === "development") return null;
  if (pathname.startsWith("/s/")) return null;

  return (
    <Script id="ms-clarity" nonce={nonce} strategy="afterInteractive">
      {CLARITY_SNIPPET}
    </Script>
  );
}
