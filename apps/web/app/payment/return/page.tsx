import type { Metadata } from "next";
import { renderPaymentReturnPage } from "../../components/payment-return-view";

export const metadata: Metadata = {
  title: "Kết quả thanh toán – BrewLite",
};

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderPaymentReturnPage({ searchParams });
}
