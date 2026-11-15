import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrewLite Menu",
  description: "Menu đồ uống BrewLite",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link className="brand" href="/">
              <span className="brand-icon">☕</span>
              <span>BrewLite<small>COFFEE &amp; GOOD DAYS</small></span>
            </Link>
            <nav aria-label="Điều hướng chính">
              <Link href="/">Thực đơn</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer>
          <div><strong>BrewLite</strong><p>Một ly cà phê, một khoảnh khắc đáng nhớ.</p></div>
          <div><strong>Nhận tại quầy</strong><p>Đặt trực tuyến và nhận món tại cửa hàng.</p></div>
        </footer>
      </body>
    </html>
  );
}
