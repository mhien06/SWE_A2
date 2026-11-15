"use client";

export default function ProductError({ reset }: { reset: () => void }) {
  return (
    <div className="state-box" role="alert">
      <p>Không tải được món.</p>
      <button type="button" onClick={reset}>Thử lại</button>
    </div>
  );
}
