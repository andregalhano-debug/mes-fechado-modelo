import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // mupdf (abrir PDF com senha) e imapflow rodam como pacotes Node no servidor, fora do bundle.
  serverExternalPackages: ["mupdf", "imapflow"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // App privado: nada de indexar, guardar em cache de busca, resumir ou indexar imagens.
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
        ],
      },
    ];
  },
};

export default nextConfig;
