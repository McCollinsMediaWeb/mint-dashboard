import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (username === "mintsuperadmin" && password === "Zei0GjlGykJx") {
      const cookieStore = await cookies();
      cookieStore.set("mint_auth_token", "authenticated_superadmin_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  } catch (error: any) {
    console.error("Login API Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
