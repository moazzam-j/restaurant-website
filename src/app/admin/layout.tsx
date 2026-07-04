import AdminHeader from "@/components/AdminHeader";

export const metadata = {
  title: "Admin — DCF",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminHeader />
      {children}
    </>
  );
}
