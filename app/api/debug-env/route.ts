import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({
      status: "undefined",
      message: "DATABASE_URL is not set on this server! Please add it in Vercel settings and trigger a redeploy."
    });
  }

  // Mask password for safety
  let masked = url;
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "****";
    }
    masked = parsed.toString();
  } catch (e) {
    masked = url.substring(0, 15) + "...";
  }

  return NextResponse.json({
    status: "defined",
    maskedUrl: masked,
    nodeEnv: process.env.NODE_ENV
  });
}
