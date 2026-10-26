import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim() || "dev";
  } catch {
    return "dev";
  }
})();
const buildTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).format(new Date()).replace(",", "");

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
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
