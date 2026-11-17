"use client";

import Link from "next/link";
import { useAuthSession } from "./auth-session";
import { roleHome } from "./customer-menu-guard";

export default function SiteFooter() {
  const { session, ready } = useAuthSession();
  const role = session?.user.role;
  const home = role ? roleHome(role) : "/";
  const operations = role === "STAFF" || role === "MANAGER";

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-intro">
          <Link href={home} className="footer-logo">BrewLite<span>®</span></Link>
          <h2>{operations ? "Vận hành gọn gàng.\nPhục vụ trọn vẹn." : "Một chút xanh.\nMột ngày lành."}</h2>
          <p>{operations ? "Không gian làm việc dành riêng cho nhân viên và quản lý BrewLite." : "Cà phê đậm đà, trà thanh mát và những khoảng nghỉ dành riêng cho bạn."}</p>
        </div>
        {ready && operations ? (
          <>
            <div className="footer-column">
              <h3>Vận hành</h3>
              <Link href="/staff/orders">Đơn hàng</Link>
              {role === "MANAGER" && <Link href="/manager/products">Quản lý món</Link>}
            </div>
            <div className="footer-column">
              <h3>Quản lý cửa hàng</h3>
              {role === "MANAGER" ? <Link href="/staff/inventory">Kho &amp; công thức</Link> : <p>Cập nhật trạng thái đơn và phục vụ khách tại quầy.</p>}
            </div>
          </>
        ) : (
          <>
            <div className="footer-column"><h3>Khám phá</h3><Link href="/">Thực đơn</Link><Link href="/cart">Giỏ hàng</Link><Link href="/orders">Đơn hàng của bạn</Link></div>
            <div className="footer-column"><h3>Hẹn bạn tại quầy</h3><p>Chọn món yêu thích.<br />Tùy chỉnh theo gu.<br />Đặt trước và nhận tại cửa hàng.</p><Link href="/" className="footer-cta">Chọn một ly ngay ↗</Link></div>
          </>
        )}
      </div>
      <div className="footer-bottom"><span>© BrewLite. Coffee &amp; good days.</span><span>Được pha chế với sự tận tâm ✳</span></div>
    </footer>
  );
}
