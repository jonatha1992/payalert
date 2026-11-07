import { NextResponse } from "next/server";
import pkg from "@/../package.json";
import { execSync } from "node:child_process";

export const dynamic = "force-dynamic";

export async function GET() {
  let sha = process.env.GIT_SHA || "unknown";
  if (sha === "unknown") {
    try {
      sha = execSync("git rev-parse --short HEAD").toString().trim();
    } catch {}
  }
  return NextResponse.json({
    version: pkg.version || "0.1.0",
    sha,
  });
}
