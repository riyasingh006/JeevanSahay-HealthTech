import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "js_session";

const PATIENT_ROUTES = ["/dashboard", "/profile", "/notifications", "/compare"];
const HOSPITAL_ADMIN_ROUTES = ["/hospital-portal", "/hospital"];
const SUPER_ADMIN_ROUTES = ["/admin"];

function secretKey(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || new TextEncoder().encode(secret).length < 32) return null;
  return new TextEncoder().encode(secret);
}

async function readSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const key = secretKey();
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: "jeevan-sahay",
      audience: "session",
    });
    if (!payload.sub || typeof payload.sid !== "string" || typeof payload.ver !== "number") {
      return null;
    }
    return payload as { sub: string; role?: string; hospitalId?: string; sid: string; ver: number };
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSession(req);

  const needsAuth =
    PATIENT_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    HOSPITAL_ADMIN_ROUTES.some((p) => pathname.startsWith(p)) ||
    SUPER_ADMIN_ROUTES.some((p) => pathname.startsWith(p));

  if (needsAuth && !session) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    login.searchParams.set("reason", "auth");
    return NextResponse.redirect(login);
  }

  if (session) {
    if (
      SUPER_ADMIN_ROUTES.some((p) => pathname.startsWith(p)) &&
      session.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.redirect(new URL("/dashboard?denied=admin", req.url));
    }
    if (
      HOSPITAL_ADMIN_ROUTES.some((p) => pathname.startsWith(p)) &&
      (session.role !== "SUPER_ADMIN" &&
        (session.role !== "HOSPITAL_ADMIN" || !session.hospitalId))
    ) {
      return NextResponse.redirect(
        new URL("/dashboard?denied=portal", req.url)
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/notifications/:path*",
    "/compare",
    "/hospital-portal/:path*",
    "/hospital/:path*",
    "/admin/:path*",
  ],
};
