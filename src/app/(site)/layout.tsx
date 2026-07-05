import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { CartProvider } from "@/lib/cart-context";
import FloatingCartButton from "@/components/FloatingCartButton";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
      <FloatingCartButton />
    </CartProvider>
  );
}
