# Sequence Diagram – Đặt hàng và thanh toán

Sơ đồ mô tả cách BrewLite tạo đơn hàng và xác nhận thanh toán qua **VNPay Sandbox**.

## Bộ sơ đồ bàn giao – Issue #5

| Nội dung | PlantUML | Draw.io chỉnh sửa được | SVG | PNG xem nhanh |
|---|---|---|---|---|
| Tổng quan Checkout | [Nguồn](sources/sequence-checkout.puml) | [Draw.io](sources/sequence-checkout.drawio) | [SVG](exports/sequence-checkout.svg) | [PNG](exports/sequence-checkout.png) |
| Tạo đơn và TX1 | [Nguồn](sources/sequence-create-order.puml) | [Draw.io](sources/sequence-create-order.drawio) | [SVG](exports/sequence-create-order.svg) | [PNG](exports/sequence-create-order.png) |
| VNPay, IPN, QueryDR, TX2 | [Nguồn](sources/sequence-payment-vnpay.puml) | [Draw.io](sources/sequence-payment-vnpay.drawio) | [SVG](exports/sequence-payment-vnpay.svg) | [PNG](exports/sequence-payment-vnpay.png) |
| Hủy đơn, hoàn kho và điểm, TX3 | [Nguồn](sources/sequence-cancel-order.puml) | [Draw.io](sources/sequence-cancel-order.drawio) | [SVG](exports/sequence-cancel-order.svg) | [PNG](exports/sequence-cancel-order.png) |

Ba nguồn đầu là file bắt buộc của [Issue #5](https://github.com/mhien06/SWE_A2/issues/5). Sơ đồ hủy được tách riêng để làm rõ FR-15–FR-20. Các khung `ref` trong tổng quan dẫn đến các sơ đồ chi tiết, không bỏ qua các nhánh lỗi.

**Tài liệu đối chiếu:** [SRS](../requirements/srs.md) và [đặc tả Use Case Checkout](../requirements/use-case-checkout.md).

## Thành phần

`Customer` → `Next.js UI` → `NestJS API` → `Database` → `VNPay Sandbox`

- **Customer:** actor hình người, đặt hàng, thanh toán và xem kết quả. Sơ đồ hủy dùng actor `Customer / Staff`; nhánh quyền phân biệt rõ hai vai trò.
- **Next.js UI:** nhận thao tác, gọi API và hiển thị trạng thái.
- **NestJS API:** kiểm tra dữ liệu, tạo đơn, xác minh thanh toán.
- **Database:** lưu đơn hàng, lượt thanh toán, nguyên liệu và điểm.
- **VNPay Sandbox:** cổng thanh toán thử nghiệm, gửi kết quả giao dịch.

## Luồng chính

1. Khách xác nhận giỏ hàng; UI gửi yêu cầu tạo đơn.
2. API xác thực JWT, kiểm tra giỏ và tính lại giá trên server.
3. API lưu đơn `PENDING` với hạn **15 phút**; **chưa trừ nguyên liệu**.
4. UI yêu cầu thanh toán; API kiểm tra `Idempotency-Key`, tạo hoặc trả lại lượt thanh toán phù hợp và cung cấp URL VNPay.
5. Khách thanh toán trên VNPay Sandbox. Backend nhận IPN hoặc kết quả đối soát và kiểm tra chữ ký, mã tham chiếu, số tiền.
6. Nếu giao dịch hợp lệ và đơn đủ điều kiện, API ghi `PAID`, trừ nguyên liệu và cộng điểm **đúng một lần**.
7. UI đọc trạng thái từ backend và hiển thị kết quả cho khách.

## Nhánh xử lý

- **Thanh toán thất bại:** Payment `FAILED`, Order `PAYMENT_FAILED` nếu đơn vẫn chờ thanh toán; không hạ trạng thái đơn đã `PAID` hoặc `CANCELLED`. Chỉ thử lại khi đơn còn hạn và lượt trước đã kết thúc rõ ràng.
- **Đang xác minh (`PENDING/UNKNOWN`):** chờ đối soát, không tạo lượt thanh toán cạnh tranh.
- **Gửi lại yêu cầu:** cùng `Idempotency-Key` và nội dung thì dùng lại kết quả/lượt cũ; cùng key khác payload bị từ chối. URL cũ chỉ dùng khi attempt và Order còn hợp lệ. IPN lặp không cập nhật kho hoặc điểm lần hai.
- **Đơn quá hạn:** không tạo lượt thanh toán mới; đối soát giao dịch chưa rõ trước khi quyết định hủy.
- **IPN không hợp lệ:** chữ ký, mã tham chiếu hoặc số tiền sai không làm đổi trạng thái Payment/Order.
- **Thanh toán đến muộn khi Order đã `CANCELLED`:** Payment `SUCCEEDED`, Order giữ `CANCELLED`; không mở lại đơn, không trừ nguyên liệu hoặc cộng điểm thưởng. Kiểm tra refund cũ trước khi bù điểm.
- **Thanh toán thành công nhưng thiếu nguyên liệu:** Payment `SUCCEEDED`, Order `PAYMENT_EXCEPTION`; không chuyển `PAID`, không trừ kho hoặc cộng `EARN`. Kiểm tra refund cũ và ledger trước khi bù `ceil(VNPay thực trả / 100)` điểm đúng một lần.
- **QueryDR:** scheduler thuộc backend tra cứu ngoài transaction giữ khóa, xác minh phản hồi và dùng chung quy trình TX2/idempotency với IPN. Kết quả chưa rõ tiếp tục chờ đối soát.
- **Hủy đơn:** Customer chỉ hủy đơn của mình trước pha; Staff chỉ hủy `PAID` trước pha và phải có lý do. Khóa Order đồng bộ với thao tác bắt đầu pha; kiểm tra lại trạng thái sau đối soát.
- **Hoàn kho và điểm:** hủy đơn đã trả tiền hoàn theo usage thực tế đã trừ, không theo recipe mới; hoàn điểm dùng, thu hồi điểm thưởng và bù VNPay theo ledger một lần. Refund cũ `PENDING/UNKNOWN` khóa bù; refund `SUCCEEDED` hoặc đã bù thì không cấp quyền lợi trùng.
- **Tự hủy:** chỉ `PENDING/PAYMENT_FAILED` đã hết 15 phút và đã loại trừ giao dịch thành công/chưa rõ. Không tự hủy `PAID` chỉ vì hết hạn.
- **Rollback:** TX1/TX2/TX3 lỗi ở bất kỳ lệnh ghi hoặc commit đều rollback; không trả kết quả thành công. Khung `alt` phân biệt transaction không lỗi với nhánh lỗi/rollback, không rollback sau commit thành công. Transaction bù điểm cũng rollback và retry bằng khóa nghiệp vụ duy nhất.

## Truy vết

| Nội dung | Yêu cầu / quy tắc | Use Case | Activity đối chiếu |
|---|---|---|---|
| Validate, giá backend, snapshot, hạn 15 phút, TX1 | FR-04–FR-07, FR-21–FR-22, BR-02–BR-03 | M02–M05, E01–E03, E10 | Tạo đơn |
| Tạo attempt, key trùng/khác payload, chặn UNKNOWN/hết hạn | FR-07–FR-08, FR-11–FR-13 | M06, A04–A05, A07, E06–E07 | Thanh toán VNPay |
| Xác minh IPN, trừ kho/EARN một lần, rollback | FR-09–FR-10, FR-12, NFR-04 | M08–M09, A06, E05, E10 | Thanh toán VNPay |
| QueryDR, hết hạn và giao dịch chưa rõ | FR-13, BR-04 | E06–E07 | Thanh toán VNPay / Hủy đơn |
| Thành công muộn / thiếu nguyên liệu | FR-19–FR-20, **BR-11–BR-12** | **E08–E09** | **Thanh toán VNPay** |
| Hủy, hoàn usage, điều chỉnh/bù điểm, refund cũ | FR-15–FR-20, BR-05–BR-09 | UC-13/UC-17, E11 | Hủy đơn |
| Return URL không xác nhận PAID; đọc trạng thái backend | FR-09, FR-14, BR-04 | M07–M10, A03 | Thanh toán VNPay |

Activity liên quan: [Tạo đơn](https://github.com/mhien06/SWE_A2/blob/develop/docs/diagrams/sources/activity-order-creation.drawio), [Thanh toán VNPay](https://github.com/mhien06/SWE_A2/blob/develop/docs/diagrams/sources/activity-vnpay-payment.drawio), [Hủy đơn](https://github.com/mhien06/SWE_A2/blob/develop/docs/diagrams/sources/activity-order-cancellation.drawio). SRS là căn cứ khi các sơ đồ có điểm chưa thống nhất.

## Các quyết định thiết kế cần reviewer xác nhận

- Thời điểm dùng điểm: đề xuất ghi `REDEEM` nguyên tử tại TX1 và trả lại theo ledger khi hủy hoặc ngoại lệ kết thúc. SRS yêu cầu tính nhất quán nhưng chưa chốt thời điểm này; không coi đây là chính sách đã duyệt.
- Hết hạn 15 phút không đồng nghĩa Order đã `CANCELLED`. Khi Payment chưa rõ, hệ thống phải đối soát trước khi quyết định hủy; nhánh thanh toán đến muộn trong sơ đồ áp dụng khi Order **đã** `CANCELLED`.
- Trường hợp VNPay thành công nhưng thiếu nguyên liệu: Payment `SUCCEEDED` và Order `PAYMENT_EXCEPTION` (đồng bộ Domain Class Diagram); trạng thái Payment luôn được lưu tách khỏi Order.
- Không cố định tỷ lệ `EARN`; tỷ lệ bù 1 điểm/100 VNĐ không phải tỷ lệ tích điểm. Phần giảm bằng điểm không được cộng điểm thưởng.

## Ký hiệu UML

- Đường dọc nét đứt: **lifeline**.
- Thanh chữ nhật dọc: **activation bar** (khoảng thời gian xử lý).
- Mũi tên liền: **thông điệp gửi đi**; mũi tên nét đứt: **phản hồi**.
- Khung `alt`: **những nhánh loại trừ nhau theo điều kiện**.
- Khung `opt`: nhánh tùy chọn; `loop`: tác vụ lặp; `ref`: tương tác chi tiết ở sơ đồ khác.

## Đồng bộ và tái xuất

Nguồn chuẩn là bốn file `.puml`. Chạy `python tools/render_sequence_diagrams.py` từ repo để tạo lại Draw.io (các đối tượng native, chỉnh sửa được), SVG và PNG từ cùng nội dung. Script cần Python 3 và Pillow; chỉ hỗ trợ tập cú pháp đang dùng và báo lỗi nếu gặp cú pháp khác. Nếu sửa Draw.io trực tiếp, phải cập nhật lại PlantUML trước khi tái xuất để tránh mất thay đổi.

Giữ phong cách đen trắng, nền trắng, actor hình người, không tô màu. Tài liệu Sequence chỉ đặt tại file này; không tạo lại bản trùng trong `docs/requirements/`.

> Các tên endpoint và thông điệp trong sơ đồ mang tính minh họa thiết kế, không phải cam kết API đã triển khai.
