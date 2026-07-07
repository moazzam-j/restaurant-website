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
  const role = await verifyAdminSessionToken(token);

  if (!role) {
    if (isAdminPage) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Staff are limited to order management: the /admin orders dashboard plus
  // the orders API. Everything else admin-side — menu editing, photo upload,
  // and any admin page/endpoint added in the future — is manager-only by
  // default. Enforced here at the edge so hitting a URL or API directly is
  // blocked outright, not merely hidden from the navigation.
  if (role === "staff") {
    if (isAdminPage && pathname !== "/admin") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    if (isAdminApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/orders", "/api/orders/:path*", "/api/admin/:path*"],
};
