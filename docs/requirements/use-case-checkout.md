# TASK 1.3 – ĐẶC TẢ USE CASE: ĐẶT HÀNG VÀ THANH TOÁN

> **Dự án:** BrewLite – Assignment 2
> **Người thực hiện:** Phạm Minh Thiện (`@tp9951819-cell`)
> **Người review:** Nguyễn Minh Hiển (`@mhien06`)
> **Đầu vào:** `docs/requirements/context-and-scope.md` (Task 1.1), `docs/requirements/srs.md` (Task 1.2)
> **Trạng thái:** Bản đặc tả phục vụ review; không khẳng định chức năng đã được lập trình hoặc kiểm thử.

## 1. Mục tiêu và ranh giới

BrewLite phục vụ khách đặt đồ uống tại **một cửa hàng**. Luồng trọng tâm bắt đầu khi khách xác nhận đặt hàng từ giỏ, hệ thống tính lại giá ở backend, tạo đơn `PENDING` và cho khách thanh toán bằng **VNPay Sandbox**. Đơn chỉ được ghi nhận `PAID` sau khi backend xác minh giao dịch hợp lệ và kiểm soát cập nhật nguyên liệu, điểm thưởng.

Task 1.3 đặc tả **một Use Case trọng tâm – Đặt hàng và thanh toán**, có đầy đủ trigger, tiền điều kiện, hậu điều kiện, luồng chính, nhánh thay thế/ngoại lệ, liên kết FR và tiêu chí chấp nhận. Đây là **đặc tả yêu cầu**, không phải Activity hay Sequence Diagram (thuộc Task 2).

**Trong phạm vi:** xác thực quyền đặt hàng, kiểm tra giỏ/tùy chọn, tính tổng tiền tại backend, sử dụng điểm nếu khách chọn, tạo đơn, thanh toán VNPay Sandbox, xác minh kết quả, thông báo và xử lý thanh toán thất bại/quá hạn/không xác định.

**Ngoài phạm vi:** tiền mặt/COD, ví giả lập, thanh toán tiền thật, giao hàng, vận hành pha chế sau khi thanh toán; đặc tả hủy đơn độc lập của Customer/Staff (UC-13/UC-17) đã được SRS giao cho nghiệp vụ riêng. Tài liệu chỉ làm rõ các xung đột với hủy để tránh xử lý thanh toán sai.

## 2. Thông tin Use Case

| Thuộc tính | Đặc tả |
|---|---|
| Tên Use Case trọng tâm | **Đặt hàng và thanh toán** |
| Các mã UC của SRS được sử dụng | **UC-06** Tạo đơn hàng; **UC-09** Thanh toán VNPay; **UC-08** Sử dụng điểm BrewLite (tùy chọn); **UC-10** Xem kết quả thanh toán (độc lập, liên quan) |
| Mục tiêu | Đặt đơn hợp lệ và nhận kết quả thanh toán đã được xác minh, hoặc được thông báo tình trạng rõ ràng để xử lý tiếp |
| Actor chính | **Customer** – khách đã đăng nhập |
| Actor phụ | **VNPay Sandbox `«Payment Service»`** – cổng thanh toán thử nghiệm bên ngoài |
| Trigger | Khách chọn **Đặt hàng / Tiến hành thanh toán** từ giỏ hàng |
| Mức ưu tiên | **Must** |
| Thành công | Order `PAID`; giao dịch đã xác minh; nguyên liệu/điểm được ghi đúng một lần |
| Kết thúc khác | Order `PENDING`, `PAYMENT_FAILED`, `CANCELLED` hoặc đang chờ đối soát, tùy kết quả thực tế |

**Ý nghĩa sơ đồ:** Use Case **Đặt hàng và thanh toán** `«include»` **UC-06 – Tạo đơn hàng** và **UC-09 – Thanh toán VNPay**. **UC-08 – Sử dụng điểm BrewLite** `«extend»` UC-06 vì đây là lựa chọn của khách, không bắt buộc ở mọi đơn. **UC-10 – Xem kết quả thanh toán** là Use Case riêng, có liên quan nhưng không bắt buộc khách phải quay về Return URL. Scheduler, database và IPN handler là thành phần nội bộ, không phải actor ngoài hệ thống.

## 3. Tiền điều kiện (Preconditions)

| Mã | Tiền điều kiện | Cách kiểm chứng |
|---|---|---|
| PRE-01 | Khách đã đăng nhập bằng JWT hợp lệ, có quyền Customer. | Token hết hạn/sai quyền bị từ chối ở backend. |
| PRE-02 | Giỏ có ít nhất một sản phẩm, số lượng/size/topping hợp lệ và sản phẩm đang bán. | Gửi giỏ rỗng/tùy chọn sai bị từ chối. |
| PRE-03 | Backend có dữ liệu giá và công thức nguyên liệu để kiểm tra đơn. | Không sử dụng đơn giá do client tự gửi để làm giá cuối. |
| PRE-04 | Tích hợp VNPay Sandbox có cấu hình cần thiết. | Nếu cổng không sẵn sàng thì áp dụng luồng ngoại lệ, không ghi thanh toán thành công. |

Việc tạo đơn **không đồng nghĩa giữ hoặc trừ nguyên liệu**. Số điểm giảm giá, nếu được yêu cầu, phải được kiểm tra theo số dư và ghi nhận/giải tỏa nhất quán ở các trạng thái kết thúc.

## 4. Hậu điều kiện (Postconditions)

| Kết quả | Trạng thái và dữ liệu phải bảo đảm |
|---|---|
| **Thành công** | Order `PAID`; Payment Attempt ghi kết quả VNPay đã xác minh. Trừ nguyên liệu theo công thức, cộng điểm thưởng thông thường và lưu sự kiện **đúng một lần**. |
| **Đã đặt, chưa thanh toán** | Order `PENDING`, lưu snapshot sản phẩm/giá và `expiresAt = createdAt + 15 phút`; **chưa trừ nguyên liệu**. |
| **Thanh toán thất bại rõ ràng** | Ghi Payment Attempt `FAILED`, Order phản ánh `PAYMENT_FAILED`; không trừ nguyên liệu/cộng điểm; còn hạn thì được thử lại với attempt khác. |
| **Đang xác minh/không rõ** | Giao dịch `PENDING/UNKNOWN` được ghi nhận riêng; không kết luận thành công/thất bại, không tạo attempt song song thiếu an toàn. |
| **Đơn hết hạn đã đối soát** | Chỉ chuyển `CANCELLED` khi xác định không có thanh toán thành công cần ghi nhận; không gia hạn Order khi thử lại. |
| **Thanh toán đến sau khi đã hủy/không đủ kho** | Lưu giao dịch đã trả tiền và tình huống ngoại lệ; không mở lại đơn `CANCELLED`, không trừ kho/cộng điểm thường sai; xử lý bù điểm theo SRS, tránh trùng VNPay Refund cũ. |

## 5. Luồng chính – Đặt hàng và thanh toán thành công

**Giả định khách đăng nhập, giỏ hợp lệ, thanh toán được xác minh hợp lệ, tồn kho đủ và đơn chưa quá hạn.**

| Bước | Tác nhân | Mô tả hành động / phản hồi |
|---|---|---|
| **M01** | Customer | Mở giỏ hàng, rà soát đồ uống, size, topping, số lượng và nhấn **Đặt hàng**. |
| **M02** | BrewLite | Xác thực JWT/quyền Customer, kiểm tra dữ liệu giỏ và tình trạng bán của sản phẩm. |
| **M03** | BrewLite | **Tính lại toàn bộ đơn giá và tổng tiền bằng dữ liệu backend**; nếu khách áp dụng điểm thì kiểm tra điểm và tách khoản giảm bằng điểm khỏi tiền phải thanh toán VNPay. |
| **M04** | Customer | Xem giá cuối cùng và xác nhận tạo đơn. |
| **M05** | BrewLite | Tạo Order/OrderItem snapshot, trạng thái `PENDING`; ghi `createdAt`, `expiresAt = createdAt + 15 phút` từ đồng hồ server. **Không trừ kho nguyên liệu**. |
| **M06** | BrewLite | Tạo Payment Attempt VNPay với mã tham chiếu duy nhất/idempotency, hạn attempt không vượt quá hạn Order; trả URL hợp lệ. |
| **M07** | Customer | Chuyển sang VNPay Sandbox và thực hiện thanh toán thử nghiệm. |
| **M08** | VNPay Sandbox / BrewLite | Nhận IPN hoặc kết quả đối soát. Backend xác minh chữ ký, tham chiếu, số tiền và tình trạng giao dịch; **Return URL chỉ phục vụ điều hướng, không tự xác nhận PAID**. |
| **M09** | BrewLite | Khi giao dịch hợp lệ, kiểm tra trạng thái Order và nguyên liệu. Thực hiện cập nhật nguyên tử, chống lặp: ghi thành công giao dịch, chuyển Order `PAID`, trừ đúng nguyên liệu, cộng điểm thưởng theo chính sách và lưu sự kiện truy vết. |
| **M10** | BrewLite / Customer | Khách xem kết quả dựa trên **trạng thái backend đã xác minh**. Đơn `PAID` được chuyển sang quy trình nhân viên tiếp nhận (ngoài Use Case này). |

## 6. Luồng thay thế (Alternative Flows)

| Mã | Bắt đầu tại | Tình huống và hướng xử lý | Kết quả |
|---|---|---|---|
| **A01** | M03 | Khách không chọn dùng điểm BrewLite. | Dùng tiền thanh toán VNPay theo tổng được backend tính. |
| **A02** | M03 | Khách chọn **UC-08 – Sử dụng điểm** hợp lệ; kiểm tra số dư, ghi nhận mức giảm và lịch sử sử dụng nhất quán. | Tổng tiền VNPay phản ánh khoản giảm, không âm; tiếp tục M04. |
| **A03** | M07–M08 | Khách đóng trang VNPay hoặc không quay lại Return URL. | Không mặc định FAILED; IPN/đối soát vẫn quyết định kết quả. |
| **A04** | M08 | VNPay xác minh **thất bại**, Order còn hạn, attempt trước đã kết thúc rõ ràng. | Ghi `PAYMENT_FAILED`, hiện **Thanh toán lại**, tạo attempt **mới** khi khách yêu cầu. |
| **A05** | M06 | Yêu cầu tạo attempt gửi lại cùng Idempotency-Key và cùng nội dung. | Trả lại attempt/kết quả cũ; không tạo giao dịch mới. Cùng key khác payload thì từ chối. |
| **A06** | M08–M09 | IPN hoặc đối soát lặp cùng giao dịch. | Chỉ xác nhận/trừ kho/cộng điểm một lần; trả kết quả idempotent. |
| **A07** | M06 | Attempt đã hết hạn, Order chưa quá 15 phút và trạng thái attempt cũ đã kết thúc xác định. | Có thể tạo attempt mới, mã tham chiếu/URL mới; không kéo dài hạn Order. |

## 7. Luồng ngoại lệ (Exception Flows)

| Mã | Bắt đầu tại | Điều kiện | Phản hồi / hậu điều kiện |
|---|---|---|---|
| **E01** | M02 | Khách chưa đăng nhập/token sai/hết hạn hoặc không có quyền. | Từ chối thao tác; không tạo Order. |
| **E02** | M02–M03 | Giỏ rỗng, sản phẩm ngừng bán, size/topping/số lượng sai, client cố sửa giá. | Báo dữ liệu không hợp lệ; lấy giá backend; không ghi đơn sai. |
| **E03** | M03 | Sử dụng điểm vượt số dư hoặc trái điều kiện áp dụng. | Từ chối khoản điểm; cho khách sửa lựa chọn; không ghi âm điểm. |
| **E04** | M06 | VNPay Sandbox hoặc kết nối không sẵn sàng. | Order đã tạo vẫn `PENDING`; không đánh dấu `PAID`; chỉ thử lại an toàn khi kết quả attempt rõ và còn hạn. |
| **E05** | M08 | IPN sai chữ ký, tham chiếu, số tiền hoặc thông tin đối soát. | Từ chối kết quả không hợp lệ; ghi log; không đổi Order sang `PAID`. |
| **E06** | M06–M08 | Payment Attempt còn `PENDING/UNKNOWN`. | Thông báo **Đang xác minh**, không tự coi FAILED hay phát sinh attempt cạnh tranh. |
| **E07** | M06–M09 | Đủ 15 phút tính từ tạo Order, chưa có giao dịch thành công được xác minh. | Không tạo attempt mới. Đối soát các attempt chưa rõ trước khi kết thúc Order; không hủy mù. |
| **E08** | M08–M09 | Giao dịch VNPay thành công đến sau khi Order đã `CANCELLED`. | Không mở lại đơn, không trừ nguyên liệu/cộng điểm thường; ghi giao dịch đến muộn, bù điểm theo SRS sau khi kiểm tra không có VNPay Refund cũ trùng. |
| **E09** | M09 | VNPay thành công nhưng nguyên liệu không đủ ở thời điểm xử lý. | Không ghi `PAID` như đơn có thể pha; lưu ngoại lệ/đối soát; không xuất kho sai, xử lý bù điểm theo giá trị VNPay thực trả. |
| **E10** | M09 | Lỗi DB/transaction trong cập nhật Order – kho – điểm. | Rollback các thay đổi chưa hoàn tất; giữ chứng cứ thanh toán để xử lý lại; không có `PAID` nửa chừng. |
| **E11** | M08–M09 | Hai yêu cầu xử lý thanh toán/hủy/chuẩn bị đồng thời. | Khóa giao dịch và kiểm tra điều kiện; chỉ một chuyển trạng thái hợp lệ thắng, không double effect. |

## 8. Quy tắc nghiệp vụ áp dụng

| Mã | Quy tắc |
|---|---|
| **QT-01** | Chỉ dùng VNPay Sandbox. Không tiền mặt, COD, ví/thẻ mô phỏng độc lập và không giao dịch thật. |
| **QT-02** | Order `PENDING` chờ **tối đa 15 phút từ `createdAt`**; retry không làm mới đồng hồ Order. |
| **QT-03** | Payment Attempt có định danh/trạng thái riêng; thời hạn attempt không vượt `expiresAt` của Order. SRS không áp một khoảng cố định cho mỗi attempt. |
| **QT-04** | Tạo Order **chưa trừ nguyên liệu**; chỉ thanh toán hợp lệ và đủ điều kiện mới trừ theo công thức, cộng điểm thường đúng một lần. |
| **QT-05** | Backend quyết định giá, kiểm tra chữ ký VNPay/IPN, số tiền, mã giao dịch; Return URL không phải bằng chứng PAID. |
| **QT-06** | Chống lặp khi tạo attempt và nhận IPN; `UNKNOWN` cần đối soát, không được coi là FAILED. |
| **QT-07** | Điểm tích thông thường theo chính sách của hệ thống. **1 điểm = 100 VND chỉ áp dụng cho điểm bù giá trị VNPay khi hủy/ngoại lệ**, không dùng làm tỷ lệ tích điểm thông thường. |
| **QT-08** | Đơn đã `CANCELLED` không được mở lại. Nếu có thanh toán đến muộn hoặc thiếu kho, ghi nhận và bù **`ceil(số VND VNPay thực trả / 100)`** điểm sau khi kiểm tra không trùng VNPay Refund cũ. |
| **QT-09** | Mọi biến động kho, điểm, kết quả thanh toán đều có ledger/log truy vết và được kiểm soát đúng một lần. |
| **QT-10** | Hủy đơn bởi Customer/Staff trước pha thuộc UC-13/UC-17, không phải hành động của VNPay hoặc scheduler trong Use Case Diagram này. |

## 9. Truy vết yêu cầu SRS – đặc tả – tiêu chí chấp nhận

| Mã SRS | Mục/bước | Tiêu chí cần kiểm thử |
|---|---|---|
| **FR-02, FR-03** | M01, E02 | Tùy chọn và giỏ hợp lệ. |
| **FR-04** | PRE-01, M02, E01 | JWT đúng quyền, từ chối truy cập trái phép. |
| **FR-05** | M02–M03, E02 | Giá cuối cùng do backend xác định. |
| **FR-06** | M05, hậu điều kiện | Tạo đơn `PENDING` có snapshot, chưa trừ kho. |
| **FR-07** | M05, E07 | `expiresAt = createdAt + 15 phút`; retry không gia hạn. |
| **FR-08** | M06–M07, A07 | Attempt VNPay hợp lệ, không dùng lại mã/URL khi retry. |
| **FR-09** | M08, E05–E06 | Chữ ký, tiền, tham chiếu hợp lệ mới công nhận kết quả. |
| **FR-10** | M09, A06, E09–E10 | Chuyển PAID/trừ kho/cộng điểm nguyên tử, đúng một lần. |
| **FR-11** | A04, A07 | Thất bại rõ, còn hạn mới được thanh toán lại. |
| **FR-12** | A05–A06 | Cùng key không tạo attempt thứ hai; IPN lặp không double effect. |
| **FR-13** | E06–E08 | Hết hạn/UNKNOWN/thành công đến muộn được đối soát an toàn. |
| **FR-14** | M10, A03 | Khách nhận kết quả đúng dữ liệu đã xác minh. |
| **FR-19, FR-20** | E08–E09 | Bù điểm đúng tỷ lệ, không bù trùng refund cũ. |
| **FR-21, FR-22** | M03, M09, A02, E03/E09 | Kiểm tra điểm và công thức nguyên liệu theo dữ liệu backend. |
| **FR-26** | M08–M09, E05–E11 | Lưu được lịch sử giao dịch, trạng thái, điểm, kho, ngoại lệ. |
| **NFR-02, NFR-03** | M02, M08, E01/E05 | Xác thực, phân quyền, kiểm tra kết quả VNPay. |
| **NFR-04, NFR-08, NFR-09** | M09, A05–A06, E06–E11 | Transaction, idempotency, quan sát, kiểm thử đủ nhánh. |

## 10. Các trường hợp kiểm thử làm cơ sở cho Task sau

| Test ID | Kịch bản | Kết quả mong đợi |
|---|---|---|
| TC-1.3-01 | Tạo đơn hợp lệ, chưa trả tiền. | Order `PENDING`, hạn 15 phút, **không trừ kho**. |
| TC-1.3-02 | VNPay thành công và được xác minh trước hạn. | Order `PAID`, trừ kho/cộng điểm **một lần**. |
| TC-1.3-03 | Khách chưa đăng nhập đặt đơn. | Từ chối; không phát sinh Order. |
| TC-1.3-04 | Client sửa giá hoặc giỏ chứa tùy chọn sai. | Backend không chấp nhận giá giả; dữ liệu sai bị từ chối. |
| TC-1.3-05 | Khách dùng điểm lớn hơn số dư. | Không trừ điểm, yêu cầu chọn lại. |
| TC-1.3-06 | VNPay FAILED, khách retry trước hạn. | Tạo attempt mới; hạn Order không thay đổi. |
| TC-1.3-07 | Attempt trước là UNKNOWN, khách retry. | Không tạo attempt cạnh tranh; chờ đối soát. |
| TC-1.3-08 | Gửi lặp cùng idempotency key. | Không tạo attempt trùng. |
| TC-1.3-09 | Gửi IPN thành công lặp. | Trừ kho/cộng điểm đúng một lần. |
| TC-1.3-10 | IPN sai chữ ký hoặc sai số tiền. | Không đổi Order thành PAID. |
| TC-1.3-11 | Hết hạn 15 phút, không có thanh toán và không còn UNKNOWN. | Kết thúc `CANCELLED`; không tạo attempt mới. |
| TC-1.3-12 | Có giao dịch UNKNOWN tại mốc 15 phút. | Đối soát, không hủy mù. |
| TC-1.3-13 | Giao dịch thành công khi Order đã CANCELLED. | Không mở lại đơn; xử lý bù điểm đúng một lần và không trùng refund cũ. |
| TC-1.3-14 | Xác minh thanh toán thành công nhưng không đủ nguyên liệu. | Không tạo PAID sai; lưu ngoại lệ và xử lý bù. |
| TC-1.3-15 | Lỗi cập nhật kho/điểm hoặc xử lý đồng thời. | Không cập nhật nửa chừng, không double effect. |

## 11. Sơ đồ và nghiệm thu Task 1.3

**Sản phẩm:**

- `docs/requirements/use-case-checkout.md`: tài liệu đặc tả **Đặt hàng và thanh toán** (file này).
- `docs/diagrams/sources/use-case-checkout.drawio`: nguồn Use Case Diagram chỉnh sửa được trên diagrams.net.
- `docs/diagrams/exports/use-case-checkout.svg`: sơ đồ đen trắng, nền trắng, tỷ lệ cố định, trích xuất từ cùng bố cục.

**Kiểm tra trước khi approve:**

- [ ] Sơ đồ có **Customer**, **VNPay Sandbox «Payment Service»**, ranh giới BrewLite; các oval đặt **bên trong** hệ thống.
- [ ] `«include»` và `«extend»` dùng đúng chiều và ý nghĩa; không vẽ IPN/scheduler/database như actor độc lập.
- [ ] Actor, trigger, tiền điều kiện, hậu điều kiện và luồng chính được mô tả rõ.
- [ ] Các nhánh thanh toán thất bại, chưa đăng nhập, quá hạn, UNKNOWN, thiếu nguyên liệu, IPN lặp được nêu đầy đủ.
- [ ] Từng tình huống có mã yêu cầu tương ứng và có thể dùng để viết test.
- [ ] Reviewer kiểm tra tính nhất quán với SRS Task 1.2 trước khi merge.

> **Ghi chú:** Sơ đồ thể hiện các **mục tiêu người dùng**; IPN, chữ ký, transaction, tồn kho và đối soát là các bước xử lý trong đặc tả và Task 2, không phải các actor bổ sung.
