import { NextResponse, type NextRequest } from "next/server";

// Quick first gate for the counter: no login cookie and no demo choice -> /login.
// It only looks at cookies; pages and API routes still check the login properly.
export function proxy(req: NextRequest) {
  const loggedIn = /^[0-9a-f]{64}$/.test(req.cookies.get("bolo_user")?.value ?? "");
  const demo = req.cookies.get("bolo_demo")?.value === "1";
  if (loggedIn || demo) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/app", "/app/:path*"] };
