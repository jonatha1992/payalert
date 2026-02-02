import type { NextConfig } from "next";

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* config options here */
  // reactCompiler: true, // Commenting out if not needed or causing issues, enabled by default in recent versions or via flag
};

export default withPWA(nextConfig);
