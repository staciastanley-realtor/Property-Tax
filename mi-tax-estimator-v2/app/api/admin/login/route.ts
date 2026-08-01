import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));

  let valid: boolean;
  try {
    valid = verifyPassword(password ?? "");
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  if (!valid) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
