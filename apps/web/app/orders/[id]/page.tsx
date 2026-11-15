import OrdersPage from "../../components/orders-page";
import { Suspense } from "react";

async function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrdersPage orderId={id} />;
}

export default function OrderDetailRoute(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p role="status">Đang tải chi tiết đơn…</p>}>
      <OrderDetail {...props} />
    </Suspense>
  );
}
