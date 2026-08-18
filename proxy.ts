import { NextResponse, type NextRequest } from "next/server";

const MONACO_CDN = "https://cdn.jsdelivr.net";
const CLARITY = "https://www.clarity.ms https://*.clarity.ms https://c.bing.com";

export function proxy(request: NextRequest): NextResponse {
  const isDev = process.env.NODE_ENV === "development";
  const nonce = btoa(crypto.randomUUID());

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${MONACO_CDN} ${CLARITY}${
      isDev ? " 'unsafe-eval'" : ""
    }`,
    `style-src 'self' 'unsafe-inline' ${MONACO_CDN}`,
    `font-src 'self' data: ${MONACO_CDN}`,
    `img-src 'self' data: blob: ${CLARITY}`,
    `connect-src 'self' ${MONACO_CDN} ${CLARITY}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];

  const policy = directives.join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
