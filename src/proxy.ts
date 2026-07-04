import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isOrdersApi =
    (pathname === "/api/orders" && req.method === "GET") ||
    (pathname.startsWith("/api/orders/") && req.method !== "POST");
  const isAdminApi =
    pathname.startsWith("/api/admin/") &&
    pathname !== "/api/admin/login" &&
    pathname !== "/api/admin/logout";
  const isProtectedApi = isOrdersApi || isAdminApi;

  if (!isAdminPage && !isProtectedApi) return NextResponse.next();

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const authed = await verifyAdminSessionToken(token);

  if (authed) return NextResponse.next();

  if (isAdminPage) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export const config = {
  matcher: ["/admin/:path*", "/api/orders", "/api/orders/:path*", "/api/admin/:path*"],
};
