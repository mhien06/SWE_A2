import type { Metadata } from "next";
import Link from "next/link";
import { AuthSessionProvider } from "./components/auth-session";
import SiteNavigation from "./components/site-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrewLite • Một chút xanh, một ngày lành",
  description: "Menu đồ uống BrewLite",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body>
        <AuthSessionProvider>
          <a className="skip-link" href="#main-content">Đến nội dung chính</a>
          <div className="announcement">PHA CHÚT TƯƠI MỚI CHO NGÀY CỦA BẠN <span>Đặt trực tuyến · Nhận tại quầy ↗</span></div>
          <header className="site-header">
            <div className="header-inner">
              <Link className="brand" href="/">
                <span className="brand-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M7 12h15v10a5 5 0 0 1-5 5h-5a5 5 0 0 1-5-5V12Zm15 2h3a4 4 0 0 1 0 8h-3M11 4v4m6-4v4M5 29h22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span>
                <span>BrewLite<small>COFFEE &amp; GOOD DAYS</small></span>
              </Link>
              <SiteNavigation />
            </div>
          </header>
          <main id="main-content">{children}</main>
          <footer className="site-footer">
            <div className="footer-inner">
              <div className="footer-intro"><Link href="/" className="footer-logo">BrewLite<span>®</span></Link><h2>Một chút xanh.<br />Một ngày lành.</h2><p>Cà phê đậm đà, trà thanh mát và những khoảng nghỉ dành riêng cho bạn.</p></div>
              <div className="footer-column"><h3>Khám phá</h3><Link href="/">Thực đơn</Link><Link href="/cart">Giỏ hàng</Link><Link href="/orders">Đơn hàng của bạn</Link></div>
              <div className="footer-column"><h3>Hẹn bạn tại quầy</h3><p>Chọn món yêu thích.<br />Tùy chỉnh theo gu.<br />Đặt trước và nhận tại cửa hàng.</p><Link href="/" className="footer-cta">Chọn một ly ngay ↗</Link></div>
            </div>
            <div className="footer-bottom"><span>© BrewLite. Coffee &amp; good days.</span><span>Được pha chế với sự tận tâm ✳</span></div>
          </footer>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
