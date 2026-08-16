import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * ts-morph, TypeScript derleyicisini ve dosya sistemi erişimini içerir.
   * Bundle'a dahil edilmek yerine sunucuda doğrudan `require` edilmeli;
   * aksi halde derleyicinin dinamik `require`'ları paketleyicide bozulur.
   */
  serverExternalPackages: ["ts-morph"],
};

export default nextConfig;
