import { cookies } from "next/headers";
import AdminHeader from "@/components/AdminHeader";
import { ADMIN_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";

export const metadata = {
  // absolute: opt out of the root layout's "%s — Delite Chicken Food" title
  // template so the admin tab title stays exactly as it was.
  title: { absolute: "Admin — DCF" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The session cookie is httpOnly (client JS can't read it), so the role is
  // resolved here on the server and handed to the header as a plain prop.
  // This only drives what the nav SHOWS — actual access control lives in
  // src/proxy.ts, which guards the routes and APIs themselves.
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const role = await verifyAdminSessionToken(token);

  return (
    <>
      <AdminHeader role={role} />
      {children}
    </>
  );
}
