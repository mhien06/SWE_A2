export type ProductSummary = {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  isAvailable: boolean;
};

export type ProductOption = {
  id: string;
  type: "SIZE" | "TOPPING";
  name: string;
  additionalPrice: number;
  isAvailable: boolean;
};

export type ProductDetail = ProductSummary & {
  options: ProductOption[];
};

const productImages: Record<string, string> = {
  "11111111-1111-4111-8111-111111111111": "/products/ca-phe-sua.jpg",
  "22222222-2222-4222-8222-222222222222": "/products/bac-xiu.jpg",
  "33333333-3333-4333-8333-333333333333": "/products/tra-dao.jpg",
  "44444444-4444-4444-8444-444444444444": "/products/matcha-latte.jpg",
};

export function formatVndPrice(amount: number) {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

export function availabilityLabel(isAvailable: boolean) {
  return isAvailable ? "CÒN BÁN" : "TẠM NGỪNG BÁN";
}

export function productImage(id: string) {
  return productImages[id] ?? "/products/ca-phe-sua.jpg";
}

export function splitOptions(options: ProductOption[]) {
  const available = options.filter((option) => option.isAvailable);
  return {
    sizes: available.filter((option) => option.type === "SIZE"),
    toppings: available.filter((option) => option.type === "TOPPING"),
  };
}
