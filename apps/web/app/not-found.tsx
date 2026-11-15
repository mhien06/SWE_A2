import Link from "next/link";

export default function NotFound() {
  return (
    <div className="state-box">
      <h1>Không tìm thấy món</h1>
      <p>Món này không tồn tại hoặc đã được gỡ khỏi menu.</p>
      <Link className="back-link" href="/">Quay lại menu</Link>
    </div>
  );
}
