import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.set("mint_auth_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0 // Expire immediately
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Logout API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Support GET for direct logout redirects if needed
export async function GET() {
  try {
    const cookieStore = await cookies();
    cookieStore.set("mint_auth_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0
    });

    // Redirect to login page
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  } catch (error: any) {
    console.error("Logout Redirect API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
