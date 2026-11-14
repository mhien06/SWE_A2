# Domain Class Diagram – BrewLite

Tài liệu giải thích domain model trong `sources/domain-class.drawio` (Task 2.3). Nguồn nghiệp vụ đối chiếu: `docs/requirements/srs.md` (Task 1.2) và `docs/requirements/use-case-checkout.md` (Task 1.3).

## 1. Phạm vi domain model

- Mô hình hóa **dữ liệu nghiệp vụ cốt lõi** của một cửa hàng: tài khoản và điểm BrewLite, menu và công thức, nguyên liệu, giỏ hàng, đơn hàng, thanh toán VNPay Sandbox, hủy đơn và theo dõi refund cũ.
- Gồm **15 class MVP**, **1 class `«future»`** (`Promotion`, nét đứt) và **11 enum**.
- Chỉ có class, attribute, enum, association, composition và multiplicity. Không có method; không có Controller, Service, Repository, API hay bảng cơ sở dữ liệu.
- Enum không nối connector; chúng là kiểu của attribute (ví dụ `Order.status: OrderStatus`).
- Hình thoi đặc nằm ở phía "toàn thể"; mũi tên mở là navigable association. Hậu tố `?` trên kiểu dữ liệu nghĩa là attribute có thể rỗng.
- **VNPay Sandbox nằm ngoài domain model** (mục 9).

## 2. Class và trách nhiệm

| Class | Trách nhiệm chính |
| :--- | :--- |
| `User` | Tài khoản Customer/Staff/Manager (`role: UserRole`, `status: UserStatus`). Chỉ lưu `passwordHash`. `pointsBalance` là số dư điểm BrewLite hiện tại. |
| `Cart` | Giỏ hàng của một User. |
| `CartItem` | Một dòng trong giỏ: Product, `quantity`, `selectedSize`, `selectedToppings: String[]` và `estimatedUnitPrice`. Đây chỉ là **giá tạm tính**; backend tính lại khi tạo Order. |
| `Product` | Đồ uống trong menu với `basePrice` và `isAvailable`. **Không lưu tồn kho**; khả năng phục vụ được xác định qua Recipe và Ingredient. |
| `ProductOption` | Size hoặc topping của Product (`type: ProductOptionType`) kèm `additionalPrice` và `isAvailable`. |
| `Ingredient` | Nguyên liệu, đơn vị tính `unit: MeasurementUnit`, tồn hiện có `quantityOnHand`, ngưỡng cảnh báo `reorderLevel`, trạng thái `isActive`. Đây là **nơi duy nhất quản lý tồn kho**. |
| `Recipe` | Công thức của một Product, có thể gắn một ProductOption (`productOptionId?`); có `version` và `isActive` để thay đổi công thức mà không ảnh hưởng lịch sử. |
| `RecipeIngredient` | Định lượng một Ingredient (`quantity`, `unit`) trong một Recipe. |
| `Order` | Đơn đặt đồ uống nhận tại quầy: `orderCode`, `status: OrderStatus`, các khoản tiền do backend tính, điểm sử dụng và `expiresAt`. |
| `OrderItem` | Một dòng của Order, lưu **snapshot** tại thời điểm đặt: `productNameSnapshot`, `selectedSizeSnapshot`, `selectedToppingsSnapshot`, `unitPriceSnapshot`, `quantity` và `lineTotal`. |
| `OrderIngredientUsage` | Bản ghi **lượng nguyên liệu thực tế đã trừ** cho một OrderItem khi Order chuyển `PAID` (`quantityDeducted`, `unitSnapshot`, `ingredientNameSnapshot`, `deductedAt`) và lượng đã hoàn khi hủy (`quantityRestored`, `restoredAt`, `restoreIdempotencyKey`). |
| `Payment` | Một lượt thanh toán (Payment Attempt) của Order qua `provider`, với `status: PaymentStatus`, `amount`, `transactionRef`, `idempotencyKey`, `providerTransactionNo`, `responseCode`, `expiresAt`, `verifiedAt`. |
| `OrderCancellation` | Thông tin hủy đơn: người hủy (`cancelledByUserId?`, `cancelledByRole?`), `reason?`, `isAutomatic` (hủy do hết hạn), `idempotencyKey`, `cancelledAt`. |
| `VNPayRefundRecord` | Theo dõi riêng một yêu cầu refund VNPay cũ của Payment (`amount`, `status: RefundStatus`, `providerRefundRef?`, `requestedAt`, `resolvedAt?`). Dùng để loại trừ quyền lợi trùng; BrewLite không mở luồng refund mới. |
| `LoyaltyTransaction` | Sổ cái (ledger) điểm BrewLite của User: `type`, `points`, `valueVnd?`, liên kết tùy chọn tới Order (`orderId?`) và Payment (`paymentId?`), `idempotencyKey` chống ghi trùng. |
| `Promotion` `«future»` | Chương trình khuyến mãi (mã, loại, giá trị, thời gian hiệu lực, trạng thái). Chưa thuộc MVP. |

**Phân biệt hai trạng thái:**

- `Order.status` dùng `OrderStatus`, thể hiện tiến trình nghiệp vụ của đơn.
- `Payment.status` dùng `PaymentStatus`, thể hiện kết quả của từng lượt thanh toán.
- Order **không** có attribute trạng thái thanh toán riêng; kết quả giao dịch chỉ được lưu tại `Payment.status` (BR-13).

**Các khoản tiền của Order:**

| Attribute | Ý nghĩa |
| :--- | :--- |
| `subtotal` | Tổng `lineTotal` của các OrderItem, tính theo dữ liệu backend (FR-05). |
| `discountAmount` | Giảm giá thông thường. Trong MVP chưa có Promotion nên mặc định `0`. |
| `totalAmount` | Tổng chính thức của đơn sau giảm giá thông thường: `subtotal − discountAmount`. |
| `pointsRedeemed` | Số điểm BrewLite khách dùng cho đơn (FR-22). |
| `pointsDiscountAmount` | Giá trị VND được giảm bằng điểm, tách riêng khỏi giảm giá thông thường. |
| `vnpayPayableAmount` | Số tiền thực tế gửi sang VNPay, tách riêng với giá trị giảm bằng điểm (FR-22). |

## 3. Enumerations

| Enum | Giá trị | Dùng tại |
| :--- | :--- | :--- |
| `UserRole` | CUSTOMER, STAFF, MANAGER | `User.role`, `OrderCancellation.cancelledByRole` |
| `UserStatus` | ACTIVE, INACTIVE | `User.status` |
| `ProductOptionType` | SIZE, TOPPING | `ProductOption.type` |
| `OrderStatus` | PENDING, PAYMENT_FAILED, PAID, PREPARING, READY_FOR_PICKUP, COMPLETED, CANCELLED | `Order.status` |
| `PaymentStatus` | PENDING, SUCCEEDED, FAILED, UNKNOWN, EXPIRED | `Payment.status` |
| `PaymentProvider` | VNPAY_SANDBOX | `Payment.provider` |
| `MeasurementUnit` | GRAM, MILLILITER, UNIT | `Ingredient.unit`, `RecipeIngredient.unit`, `OrderIngredientUsage.unitSnapshot` |
| `RefundStatus` | PENDING, SUCCEEDED, FAILED, UNKNOWN | `VNPayRefundRecord.status` |
| `LoyaltyTransactionType` | EARN, REDEEM, RETURN_REDEEMED, REVERSE_EARNED, VNPAY_COMPENSATION, ADJUST | `LoyaltyTransaction.type` |
| `PromotionType` `«future»` | FIXED_AMOUNT, PERCENTAGE | `Promotion.type` |
| `PromotionStatus` `«future»` | DRAFT, ACTIVE, INACTIVE, EXPIRED | `Promotion.status` |

Ý nghĩa `LoyaltyTransactionType`: `EARN` cộng điểm thưởng khi đơn `PAID`; `REDEEM` dùng điểm giảm giá; `RETURN_REDEEMED` trả lại điểm đã dùng khi hủy; `REVERSE_EARNED` thu hồi điểm thưởng đã cộng khi hủy; `VNPAY_COMPENSATION` bù giá trị VNPay đã trả bằng điểm; `ADJUST` điều chỉnh thủ công có truy vết.

## 4. Quan hệ và multiplicity

Multiplicity nằm cạnh class mà nó mô tả. Ví dụ `User 1 — 0..1 Cart`: mỗi User có 0..1 Cart, mỗi Cart thuộc đúng 1 User.

| # | Quan hệ | Loại | Ý nghĩa |
| :-: | :--- | :--- | :--- |
| 1 | `User 1 — 0..1 Cart` | Association | Mỗi User có tối đa một Cart. |
| 2 | `Cart 1 ◆— 0..* CartItem` | Composition | CartItem chỉ tồn tại trong Cart; Cart có thể rỗng. |
| 3 | `CartItem 0..* → 1 Product` | Navigable association | Mỗi CartItem tham chiếu đúng một Product. |
| 4 | `Product 1 ◆— 0..* ProductOption` | Composition | Size, topping thuộc về Product. |
| 5 | `Product 1 ◆— 0..* Recipe` | Composition | Mỗi Recipe thuộc đúng một Product; Product có thể có nhiều Recipe (theo tùy chọn, theo phiên bản). |
| 6 | `ProductOption 0..1 — 0..* Recipe` | Association | Recipe có thể gắn một ProductOption (ví dụ định lượng riêng cho size/topping) hoặc không (công thức cơ bản). |
| 7 | `Recipe 1 ◆— 1..* RecipeIngredient` | Composition | Một Recipe có ít nhất một dòng định lượng. |
| 8 | `RecipeIngredient 0..* → 1 Ingredient` | Navigable association | Mỗi dòng định lượng trỏ đúng một Ingredient. |
| 9 | `User 1 — 0..* Order` | Association | Mỗi Order thuộc đúng một User. |
| 10 | `Order 1 ◆— 1..* OrderItem` | Composition | Order phải có ít nhất một OrderItem. |
| 11 | `OrderItem 0..* → 1 Product` | Navigable association | Trỏ về Product gốc; dữ liệu lịch sử nằm ở các trường snapshot. |
| 12 | `OrderItem 1 ◆— 0..* OrderIngredientUsage` | Composition | Rỗng khi Order chưa `PAID`; sau khi trừ kho có một bản ghi cho mỗi nguyên liệu đã trừ. |
| 13 | `OrderIngredientUsage 0..* → 1 Ingredient` | Navigable association | Bản ghi trừ/hoàn trỏ về Ingredient để cập nhật tồn; tên và đơn vị đã được snapshot. |
| 14 | `Order 1 ◆— 0..* Payment` | Composition | Order mới chưa có Payment; có thể có nhiều lượt thanh toán (mục 6). |
| 15 | `Payment 1 ◆— 0..* VNPayRefundRecord` | Composition | Thường không có; chỉ phát sinh khi tồn tại yêu cầu refund VNPay cũ cần đối soát. |
| 16 | `Order 1 ◆— 0..1 OrderCancellation` | Composition | Mỗi Order bị hủy tối đa một lần; Order không bị hủy thì không có bản ghi. |
| 17 | `User 0..1 — 0..* OrderCancellation` | Association | Người thực hiện hủy; rỗng khi hệ thống tự hủy do hết hạn (`isAutomatic = true`). |
| 18 | `User 1 — 0..* LoyaltyTransaction` | Association | Mỗi giao dịch điểm thuộc đúng một User. |
| 19 | `Order 0..1 — 0..* LoyaltyTransaction` | Association | Giao dịch điểm có thể gắn với một Order (EARN, REDEEM, hoàn/thu hồi, bù) hoặc không (ADJUST). |
| 20 | `Promotion 0..1 — 0..* Order` | Association (`«future»`) | Mỗi Order áp dụng tối đa một Promotion. |

## 5. Vòng đời Order

```text
PENDING ──(thanh toán thất bại đã xác minh)──> PAYMENT_FAILED
PENDING / PAYMENT_FAILED ──(Payment SUCCEEDED đã xác minh)──> PAID
PAID → PREPARING → READY_FOR_PICKUP → COMPLETED
PENDING / PAYMENT_FAILED / PAID (chưa pha) ──(hủy hợp lệ hoặc hết hạn)──> CANCELLED
```

- Order được tạo ở `PENDING` cùng OrderItem snapshot; **chưa trừ nguyên liệu** (FR-06, BR-02).
- `expiresAt = createdAt + 15 phút` theo đồng hồ server; thanh toán lại **không** gia hạn Order (FR-07, BR-03).
- Chỉ Payment được backend xác minh `SUCCEEDED` mới chuyển Order sang `PAID` (FR-09, FR-10).
- Thanh toán thất bại đã xác minh chuyển Order sang `PAYMENT_FAILED`; còn hạn thì khách được thử lại bằng Payment mới (FR-11, BR-13).
- Từ `PAID`, Staff/Manager chuyển tuần tự từng bước; không bỏ bước, không quay lui (FR-24).
- Từ `PREPARING` trở đi không được hủy; `CANCELLED` không chuyển lại trạng thái hoạt động (BR-06).

## 6. Vòng đời Payment và nhiều Payment cho một Order

| `PaymentStatus` | Ý nghĩa | Cho phép tạo Payment mới |
| :--- | :--- | :--- |
| `PENDING` | Đã tạo yêu cầu, chưa có kết quả đáng tin cậy. | **Không** |
| `UNKNOWN` | Chưa xác định được kết quả (IPN chậm/không đến, lỗi mạng) hoặc cần đối soát. | **Không** |
| `SUCCEEDED` | Backend đã xác minh chữ ký, mã tham chiếu, số tiền và mã kết quả. | Không (đơn đã thanh toán) |
| `FAILED` | Kết quả thất bại đã được xác minh. | Có, nếu Order còn hạn |
| `EXPIRED` | Quá `Payment.expiresAt`, đã kiểm tra không có kết quả thành công hợp lệ. | Có, nếu Order còn hạn |

- Mỗi lượt thanh toán là một yêu cầu riêng với `transactionRef`, `idempotencyKey` và `expiresAt` mới; `Payment.expiresAt ≤ Order.expiresAt` (FR-08, BR-03).
- Giữ mọi lượt để truy vết và đối soát, nên multiplicity là `Order 1 ◆— 0..* Payment`. Mỗi Order có **tối đa một** Payment `SUCCEEDED` hợp lệ.
- `PENDING`/`UNKNOWN` **không** được tự kết luận là thất bại; phải đối soát trước khi tạo lượt mới hoặc hủy đơn (FR-11, FR-13, BR-04).
- Return URL chỉ phục vụ hiển thị, không phải bằng chứng thanh toán (FR-09).

## 7. Tồn kho theo Ingredient và Recipe

- `Product` không lưu tồn kho. Tồn kho chỉ nằm ở `Ingredient.quantityOnHand`; lượng cần cho mỗi OrderItem được tính từ `Recipe` đang hiệu lực của Product và ProductOption đã chọn qua `RecipeIngredient` (FR-21).
- Tạo Order **không** trừ hoặc giữ nguyên liệu.
- Khi Order chuyển `PAID`: trừ `quantityOnHand` và tạo `OrderIngredientUsage` với `quantityDeducted`, `unitSnapshot`, `ingredientNameSnapshot`, trong cùng transaction với việc ghi nhận thanh toán, **đúng một lần** (FR-10).
- Khi hủy Order đã trừ kho: hoàn theo `quantityDeducted` đã lưu, **không** tính lại từ Recipe hiện tại; ghi `quantityRestored`, `restoredAt`, `restoreIdempotencyKey` (FR-17, FR-21, BR-07).
- Hủy Order chưa thanh toán thì không có OrderIngredientUsage và lượng hoàn bằng 0 (FR-17).

## 8. Business rules và invariant

**Thanh toán và chống lặp**

1. Order mới ở `PENDING`, chưa trừ nguyên liệu (FR-06, BR-02).
2. Chỉ giao dịch được backend xác minh thành công mới chuyển Order sang `PAID`; khi đó trừ nguyên liệu và cộng điểm (`EARN`) **đúng một lần** (FR-09, FR-10).
3. Backend đối chiếu chữ ký, mã tham chiếu và số tiền giao dịch trước khi công nhận thanh toán (FR-09). Không cộng điểm thưởng trên phần đã giảm bằng điểm (FR-10).
4. Thanh toán thất bại đã xác minh chuyển Order sang `PAYMENT_FAILED` và được thử lại khi còn hạn (FR-11, BR-13).
5. `Idempotency-Key` (`Payment.idempotencyKey`) ngăn tạo giao dịch lặp: cùng key và cùng nội dung trả lại kết quả cũ; cùng key khác nội dung bị từ chối. IPN hoặc đối soát lặp không tạo tác động phụ (FR-12, BR-09).
6. Order hết hạn sau 15 phút tính từ `createdAt`; thử lại thanh toán không gia hạn; quá hạn không tạo Payment mới (FR-07, FR-13).
7. `PENDING`/`UNKNOWN` không được tự kết luận thất bại; Order hết hạn chỉ tự hủy khi đã xác nhận không có giao dịch thành công (FR-13, BR-04).

**Hủy đơn**

8. CUSTOMER hủy đơn **của mình** khi `PENDING`, `PAYMENT_FAILED` hoặc `PAID` chưa pha (FR-15, BR-05).
9. STAFF hủy đơn `PAID` trước pha và **bắt buộc** có `reason` (FR-16, BR-05).
10. Từ `PREPARING` trở đi không được hủy (BR-06).
11. Mỗi Order có tối đa một `OrderCancellation`; `idempotencyKey` bảo đảm gọi hủy lặp không gây tác động lặp (BR-09).
12. Hủy đơn đã trừ kho phải hoàn đúng `quantityDeducted` đã snapshot, đúng một lần; `quantityRestored ≤ quantityDeducted`; kho không âm (FR-17, BR-07).

**Điểm BrewLite**

13. Mọi biến động điểm được ghi bằng `LoyaltyTransaction`, không xóa lịch sử; `idempotencyKey` bảo đảm mỗi nghiệp vụ chỉ ghi một lần (FR-18, BR-10). Không sử dụng điểm vượt số dư (FR-22).
14. Hủy đơn đã `PAID`: hoàn điểm đã dùng (`RETURN_REDEEMED`) và thu hồi điểm thưởng đã cộng (`REVERSE_EARNED`) (FR-18, BR-07, BR-08).
15. Hủy hợp lệ đơn đã thanh toán VNPay Sandbox được bù bằng điểm BrewLite (`VNPAY_COMPENSATION`): `points = ceil(số tiền VNPay thực trả / 100)`, `valueVnd` lưu số VND đã trả, `paymentId` trỏ Payment tương ứng. Ví dụ 29.050đ → 291 điểm (FR-19, BR-08).
16. Điểm bù **không phải** VNPay hoàn tiền; tỷ lệ 1 điểm = 100 VND chỉ áp dụng cho điểm bù, không phải tỷ lệ tích điểm thông thường (FR-19, BR-10).
17. Giao dịch thành công đến sau khi Order đã `CANCELLED`: không mở lại đơn, không trừ nguyên liệu, không `EARN`; bù điểm đúng một lần theo quy tắc 15 (FR-19, BR-11).

**Refund VNPay cũ**

18. `VNPayRefundRecord` theo dõi riêng các yêu cầu refund cũ; mỗi Payment chỉ được nhận **một** quyền lợi: refund VNPay **hoặc** điểm bù (FR-20, BR-09).
19. Refund cũ `SUCCEEDED` thì không cấp điểm bù; refund `PENDING`/`UNKNOWN` thì khóa bù và đối soát trước (FR-20).

## 9. MVP, future và ranh giới VNPay Sandbox

**MVP (15 class):** User, Cart, CartItem, Product, ProductOption, Ingredient, Recipe, RecipeIngredient, Order, OrderItem, OrderIngredientUsage, Payment, OrderCancellation, VNPayRefundRecord, LoyaltyTransaction.

- `LoyaltyTransaction` là class MVP (nét liền) vì điểm BrewLite là yêu cầu Must (FR-10, FR-18, FR-19, FR-22).
- Nguyên liệu và công thức (`Ingredient`, `Recipe`, `RecipeIngredient`, `OrderIngredientUsage`) là MVP theo FR-17, FR-21.

**Future:** `Promotion` vẫn là `«future»` (nét đứt) cùng `PromotionType`, `PromotionStatus`; SRS không có FR cho khuyến mãi. MVP không phụ thuộc Promotion và `Order.discountAmount` bằng `0`.

**VNPay Sandbox không phải domain entity:**

- Đây là hệ thống ngoài BrewLite (actor `VNPay Sandbox «Payment Service»`), không vẽ thành class.
- BrewLite chỉ lưu dấu vết giao dịch trong `Payment` (`provider = VNPAY_SANDBOX`, `transactionRef`, `providerTransactionNo`, `responseCode`, `verifiedAt`) và dấu vết refund cũ trong `VNPayRefundRecord`.
- Return URL, IPN, chữ ký và đối soát là hành vi xử lý của UC-09, không phải dữ liệu miền.
- Không lưu số thẻ, CVV hoặc thông tin ngân hàng.

## 10. Truy vết với SRS và Use Case

| Class / thành phần | FR | BR | UC / bước đặc tả |
| :--- | :--- | :--- | :--- |
| `User`, `UserRole`, `UserStatus` | FR-04 | – | UC-01, UC-02; PRE-01 |
| `Product`, `ProductOption` | FR-01, FR-02, FR-25 | – | UC-03, UC-04, UC-18 |
| `Cart`, `CartItem` | FR-03, FR-05 | – | UC-05; M01–M03 |
| `Order`, `OrderItem`, `OrderStatus` | FR-05, FR-06, FR-07, FR-23, FR-24 | BR-02, BR-03, BR-06, BR-13 | UC-06, UC-11, UC-12, UC-14–UC-16; M03–M05 |
| `Payment`, `PaymentStatus`, `PaymentProvider` | FR-08–FR-14 | BR-01, BR-03, BR-04, BR-09, BR-13 | UC-09, UC-10; M06–M10, A03–A07, E04–E07 |
| `Ingredient`, `Recipe`, `RecipeIngredient`, `MeasurementUnit` | FR-21, FR-25 | BR-02 | UC-19, UC-20; PRE-03 |
| `OrderIngredientUsage` | FR-10, FR-17, FR-21 | BR-07, BR-09 | M09, A06; UC-13, UC-17 |
| `OrderCancellation` | FR-13, FR-15, FR-16, FR-17 | BR-05, BR-06, BR-09 | UC-13, UC-17; E07 |
| `LoyaltyTransaction`, `LoyaltyTransactionType` | FR-10, FR-18, FR-19, FR-22 | BR-07, BR-08, BR-10, BR-11 | UC-07, UC-08; A02, E03, E08 |
| `VNPayRefundRecord`, `RefundStatus` | FR-20 | BR-09, BR-11 | UC-13, UC-17; E08 |
| Ghi vết sự kiện (`*At`, `idempotencyKey`, ledger) | FR-26 | BR-09 | M08–M09, E05–E11 |
| `Promotion` `«future»` | – | – | – |

## 11. Quyết định mô hình

- `CartItem`/`OrderItem` lưu size, topping dạng chuỗi nên không có association tới `ProductOption`; backend đối chiếu khi tạo Order và chọn Recipe tương ứng.
- Các attribute khóa (`userId`, `orderId`, `paymentId`...) được giữ bên cạnh association để rõ dữ liệu cần lưu. `Order` không có `promotionId` vì Promotion là `«future»`.
- Tỷ lệ tích điểm thông thường (`EARN`) chưa được chốt (SRS §8); mô hình chỉ ghi nhận giao dịch, không cố định tỷ lệ.
- SRS chưa quy định Order có quay lại `PENDING` khi tạo Payment mới từ `PAYMENT_FAILED` hay không; mô hình chỉ yêu cầu Order còn hạn và lượt trước đã kết thúc rõ ràng.

## 12. Điểm cần nhóm xác nhận

> Các nội dung dưới đây là **đề xuất hoặc vấn đề còn mở**, chưa được SRS và đặc tả Use Case xác nhận đầy đủ. Chúng **không phải** business rule, invariant hay yêu cầu chính thức của mô hình cho đến khi nhóm duyệt.

1. **Công thức `vnpayPayableAmount`** (đề xuất): `vnpayPayableAmount = totalAmount − pointsDiscountAmount`, không âm; và khi xác minh giao dịch, `Payment.amount` phải bằng `Order.vnpayPayableAmount`. SRS chỉ yêu cầu tách riêng tiền VNPay thực trả và giá trị điểm giảm (FR-22) và đối chiếu số tiền (FR-09), chưa chốt công thức.
2. **Quan hệ `pointsBalance` và ledger** (đề xuất): `User.pointsBalance` luôn bằng tổng `LoyaltyTransaction.points` của User và không âm. SRS chỉ yêu cầu không dùng vượt số dư và ghi sổ mọi biến động (FR-18, FR-22).
3. **Recipe đang hiệu lực** (đề xuất): mỗi cặp Product/ProductOption chỉ có tối đa một Recipe `isActive = true` tại một thời điểm. SRS chưa quy định cách chọn công thức khi có nhiều phiên bản (FR-21).
4. **VNPay thành công nhưng không đủ nguyên liệu** (vấn đề mở, BR-12): `OrderStatus` hiện chưa có giá trị cho "trạng thái ngoại lệ để đối soát". Phương án tạm: Payment `SUCCEEDED`, Order không chuyển `PAID`, bù điểm bằng `VNPAY_COMPENSATION`. Cần nhóm quyết định có bổ sung trạng thái ngoại lệ hay không.
5. **Refund cũ ở trạng thái `FAILED`** (vấn đề mở, FR-20): SRS chỉ quy định refund `SUCCEEDED` thì không bù và refund đang xử lý/chưa rõ thì khóa bù; chưa nêu refund `FAILED` có cho phép bù điểm hay không.
