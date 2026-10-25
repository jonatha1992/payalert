import type { NextConfig } from "next";

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* config options here */
  // reactCompiler: true, // Commenting out if not needed or causing issues, enabled by default in recent versions or via flag
  // 301 del dominio de Vercel al propio. /api queda afuera hasta migrar Mercado Pago (webhook y OAuth).
  async redirects() {
    return [
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host" as const, value: "payalert-kappa.vercel.app" }],
        destination: "https://payalert.tecnofusion.dev/:path",
        permanent: true,
      },
    ];
  },
};

export default withPWA(nextConfig);
