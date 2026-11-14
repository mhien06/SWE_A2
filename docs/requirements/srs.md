# TASK 1.2 – ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS) BREWLITE

> **Dự án:** BrewLite – Assignment 2  
> **Người thực hiện:** Trần Minh Hiệp (`@TranMinhHiep2711`)  
> **Người review:** Nguyễn Minh Hiển (`@mhien06`)  
> **Tài liệu đầu vào:** `docs/requirements/context-and-scope.md` (Task 1.1)  
> **Trạng thái:** Bản SRS và Use Case tổng quát để reviewer duyệt; mô tả yêu cầu dự kiến, không xác nhận mã nguồn đã triển khai.

## 1. Giới thiệu

### 1.1. Mục đích
Tài liệu này xác định các yêu cầu chức năng (FR), phi chức năng (NFR), mức ưu tiên MoSCoW, điều kiện chấp nhận và phạm vi Use Case tổng quát của BrewLite. SRS là cơ sở cho đặc tả Checkout ở Task 1.3, sơ đồ Task 2, kiến trúc Task 3, hiện thực và kiểm thử Task 4–5.

### 1.2. Phạm vi sản phẩm
BrewLite hỗ trợ **một cửa hàng đồ uống**, với luồng **Xem menu → Chọn size/topping → Giỏ hàng → Tạo đơn → Thanh toán VNPay Sandbox → Theo dõi đơn → Nhận tại quầy**. Hệ thống dùng Next.js mobile-first/PWA, NestJS API và PostgreSQL. Chỉ hỗ trợ **VNPay Sandbox «Payment Service»**, là hệ thống bên ngoài dùng giao dịch thử nghiệm, không phát sinh tiền thật. Khách hàng (Customer), nhân viên (Staff), quản lý (Manager) được phân quyền.

### 1.3. Quy ước
- **FR:** yêu cầu chức năng; **NFR:** yêu cầu phi chức năng; **AC:** tiêu chí chấp nhận.
- **Must:** bắt buộc; **Should:** nên có; **Could:** có thể bổ sung; **Won't:** ngoài phạm vi bản này.
- **Đơn hàng (Order)** và **lượt thanh toán (Payment Attempt)** là hai đối tượng có vòng đời riêng. `PENDING`, `PAYMENT_FAILED`, `PAID`, `PREPARING`, `CANCELLED` là các tên trạng thái nghiệp vụ của **Order** trong tài liệu này; enum kỹ thuật và các trạng thái trung gian sẽ được thống nhất khi thiết kế. Trạng thái giao dịch VNPay phải được lưu riêng.
- Mốc **15 phút** tính từ **lúc tạo Order**. Thời hạn từng lượt thanh toán phải được cấu hình không vượt quá hạn Order; thanh toán lại không gia hạn Order.

## 2. Tác nhân và quyền hạn

| Tác nhân | Vai trò chính |
|---|---|
| Customer | Xem menu, dùng giỏ hàng, đặt đơn, thanh toán, theo dõi, dùng điểm, hủy đơn của mình khi hợp lệ. |
| Staff | Xem đơn được phép xử lý, xác nhận/pha chế/bàn giao; hủy đơn PAID trước pha kèm lý do. |
| Manager | Quản lý thực đơn, vận hành và dữ liệu nguyên liệu theo phân quyền được thiết kế. |
| VNPay Sandbox «Payment Service» | Hệ thống ngoài BrewLite nhận yêu cầu thanh toán thử nghiệm và gửi/cho tra cứu kết quả giao dịch. |

Scheduler, database, backend, IPN endpoint và bộ đối soát là **thành phần nội bộ**, không phải actor con người. Giảng viên và nhóm phát triển là stakeholder, không phải actor nghiệp vụ bắt buộc trên Use Case Diagram.

## 3. Yêu cầu chức năng (FR)

### 3.1. Menu, giỏ hàng và tài khoản

| Mã | Yêu cầu | Ưu tiên | Tiêu chí chấp nhận (AC) |
|---|---|---|---|
| FR-01 | Xem danh sách đồ uống và giá, tình trạng bán. | Must | AC01: Trang menu hiển thị sản phẩm từ API; trạng thái loading/empty/error được xử lý. |
| FR-02 | Xem chi tiết đồ uống, chọn size, topping và số lượng hợp lệ. | Must | AC02: Chỉ tùy chọn hợp lệ được chọn; giá tạm tính thay đổi đúng theo lựa chọn. |
| FR-03 | Thêm, sửa, xóa mục trong giỏ hàng. | Must | AC03: Giỏ hàng phản ánh đúng sản phẩm, tùy chọn, số lượng và tổng tạm tính. |
| FR-04 | Đăng ký, đăng nhập, xác thực JWT và phân quyền Customer/Staff/Manager. | Must | AC04: Người dùng không đăng nhập không thể tạo đơn; người dùng sai quyền bị từ chối chức năng được bảo vệ. |
| FR-05 | Backend xác minh dữ liệu giỏ hàng và tính lại tổng tiền chính thức, không tin giá client. | Must | AC05: Nếu client sửa giá/giá topping, tổng tiền của đơn vẫn dựa trên dữ liệu server; dữ liệu không hợp lệ bị từ chối. |

### 3.2. Đặt đơn, thanh toán và thời hạn

| Mã | Yêu cầu | Ưu tiên | Tiêu chí chấp nhận (AC) |
|---|---|---|---|
| FR-06 | Tạo Order có mã, chi tiết/snapshot sản phẩm, số tiền và trạng thái `PENDING`. | Must | AC06: Đơn hợp lệ được lưu; **chưa trừ nguyên liệu** khi tạo đơn; thao tác thất bại không để lại đơn dang dở. |
| FR-07 | Ghi nhận thời hạn chờ thanh toán của Order là **15 phút kể từ thời điểm tạo**. | Must | AC07: `expiresAt = createdAt + 15 phút` (theo đồng hồ server); thử thanh toán lại không kéo dài thời hạn Order; quá hạn không tạo lượt thanh toán mới. |
| FR-08 | Khởi tạo lượt thanh toán **chỉ qua VNPay Sandbox**; quản lý mã tham chiếu và trạng thái riêng. | Must | AC08: Đơn đủ điều kiện mới nhận URL thanh toán; mỗi attempt có mã riêng và không được vượt quá hạn Order; không có COD/ví/thẻ mô phỏng độc lập. |
| FR-09 | Backend xác minh chữ ký/kết quả giao dịch và đối chiếu số tiền, mã tham chiếu trước khi công nhận thanh toán. | Must | AC09: Không chuyển PAID dựa vào Return URL đơn thuần; IPN sai chữ ký/mã tiền không làm đổi trạng thái đơn. |
| FR-10 | Thanh toán được xác minh thành công chuyển đơn sang `PAID`, trừ nguyên liệu theo công thức và cộng điểm **đúng một lần**. | Must | AC10: IPN hoặc tác vụ đối soát lặp không trừ nguyên liệu/cộng điểm lần hai; nếu transaction không hoàn tất thì không tạo dữ liệu PAID thiếu nhất quán. Điểm tích thông thường được tính theo chính sách điểm thưởng được quản lý/chốt riêng; không cộng điểm trên phần giá trị giảm bằng điểm. |
| FR-11 | Thanh toán thất bại được xác minh cho phép thử lại khi còn hạn và giao dịch cũ đã kết thúc rõ ràng. | Must | AC11: Thất bại được ghi nhận phù hợp; có thể thử lại hợp lệ trước `expiresAt`; không tạo attempt mới nếu attempt trước còn `PENDING/UNKNOWN`. |
| FR-12 | Kiểm soát yêu cầu thanh toán lặp bằng idempotency key và mã giao dịch duy nhất. | Must | AC12: Cùng key/cùng nội dung không sinh thêm attempt; cùng key nhưng khác nội dung bị từ chối; IPN gửi lại không tạo tác dụng phụ. |
| FR-13 | Xử lý đơn hết hạn 15 phút và đối soát khi kết quả giao dịch chưa xác định. | Must | AC13: Đơn chưa có thanh toán thành công được tự hủy sau 15 phút nếu đã xác nhận không có giao dịch thành công; trạng thái Payment `UNKNOWN/PENDING` phải được đối soát, không coi là thất bại để hủy mù; không cho tạo attempt mới sau hạn. |
| FR-14 | Ghi lịch sử thanh toán và thông tin kết quả cho khách. | Must | AC14: Khách chỉ xem được thanh toán/đơn của mình; có thể thấy thành công, thất bại, đang xác minh hoặc hết hạn theo trạng thái thực tế. |

### 3.3. Hủy đơn, nguyên liệu và điểm BrewLite

| Mã | Yêu cầu | Ưu tiên | Tiêu chí chấp nhận (AC) |
|---|---|---|---|
| FR-15 | Customer được hủy đơn của mình khi `PENDING`, `PAYMENT_FAILED` hoặc `PAID`, nếu chưa bắt đầu pha. | Must | AC15: Hủy hợp lệ chuyển `CANCELLED`; hủy đơn người khác, đơn `PREPARING` trở đi hoặc đơn đã kết thúc bị từ chối. |
| FR-16 | Staff được hủy đơn `PAID` trước pha và bắt buộc ghi lý do. | Must | AC16: Thiếu lý do bị từ chối; thông tin người hủy, lý do, thời điểm được lưu; không hủy từ `PREPARING` trở đi. |
| FR-17 | Với đơn chưa thanh toán, hủy không hoàn kho; đơn đã trừ nguyên liệu khi PAID thì hủy hợp lệ hoàn **đúng lượng đã trừ, đúng một lần**. | Must | AC17: Đơn chưa trừ kho có biến động hoàn = 0; gọi hủy lặp không hoàn kho nhiều lần; kho không âm do cập nhật đồng thời. |
| FR-18 | Khi hủy đơn PAID, điều chỉnh các điểm thưởng đã cộng và hoàn lại điểm từng dùng để giảm giá. | Must | AC18: Có lịch sử ledger ghi nhận rõ từng nghiệp vụ; chạy lại không cộng/trừ điểm lặp; không xóa lịch sử điểm. |
| FR-19 | Hủy đơn đã thanh toán VNPay Sandbox hợp lệ thì bù giá trị đã trả **bằng điểm BrewLite**, tỷ lệ `ceil(tiền VNPay thực trả / 100 VND)`. | Must | AC19: Ví dụ VNPay đã trả 29.050đ → 291 điểm bù; ghi rõ đây không phải hoàn tiền về tài khoản VNPay; cùng giao dịch chỉ có một bản ghi bù hợp lệ. Giao dịch đến muộn của đơn đã hủy được đối soát và bù theo cùng quy tắc, không mở lại đơn. |
| FR-20 | Theo dõi riêng các yêu cầu hoàn tiền VNPay cũ (nếu có), ngăn vừa hoàn VNPay vừa bù điểm cho cùng giao dịch. | Must | AC20: Nếu refund VNPay cũ đã thành công thì không cấp điểm bù; nếu refund cũ đang xử lý/chưa rõ thì khóa bù và đối soát trước; không thực hiện hai quyền lợi trùng nhau. |
| FR-21 | Quản lý nguyên liệu và công thức pha chế cho từng đồ uống/tùy chọn liên quan. | Must | AC21: Có thể xác định lượng nguyên liệu cần cho mỗi OrderItem; lượng đã trừ được lưu để hoàn lại chính xác dù công thức thay đổi sau đó. |
| FR-22 | Cho phép khách xem số dư/lịch sử điểm và áp dụng điểm để giảm giá đơn hợp lệ. | Must | AC22: Không sử dụng vượt số dư; điểm dùng được ghi sổ; số tiền VNPay thực trả và giá trị điểm giảm được tách riêng. |

### 3.4. Theo dõi, vận hành và quản lý

| Mã | Yêu cầu | Ưu tiên | Tiêu chí chấp nhận (AC) |
|---|---|---|---|
| FR-23 | Customer xem lịch sử, chi tiết, trạng thái đơn của mình. | Must | AC23: Không truy cập được đơn của người khác; trạng thái đơn hiển thị theo dữ liệu server. |
| FR-24 | Staff tiếp nhận, xác nhận, bắt đầu pha, cập nhật sẵn sàng nhận và hoàn tất đơn theo quyền. | Must | AC24: Chỉ đơn đủ điều kiện được chuyển trạng thái; không thể đồng thời bắt đầu pha và hủy thành công cùng một đơn. |
| FR-25 | Manager quản lý sản phẩm/tình trạng kinh doanh và kiểm soát nguyên liệu trong phạm vi quyền. | Should | AC25: Tài khoản không đúng quyền không được sửa dữ liệu quản lý; thay đổi có thể truy vết. |
| FR-26 | Ghi vết các sự kiện quan trọng: thanh toán, đối soát, trừ/hoàn nguyên liệu, hủy, cộng/dùng/bù điểm. | Must | AC26: Tra cứu được sự kiện theo đơn/giao dịch, thời gian và loại thao tác; bản ghi không bị tạo trùng bởi retry. |

## 4. Yêu cầu phi chức năng (NFR)

| Mã | Nhóm | Yêu cầu | Ưu tiên | Tiêu chí chấp nhận (AC) |
|---|---|---|---|---|
| NFR-01 | Hiệu năng | Các trang menu/giỏ và API phổ biến phải phản hồi phù hợp điều kiện demo, không để tác vụ đối soát chặn UI. | Must | Có đo thời gian tải/phản hồi ở môi trường kiểm thử, công bố điều kiện và kết quả; không tự khẳng định SLA production. |
| NFR-02 | Bảo mật | JWT, phân quyền phía server và kiểm tra sở hữu đơn. | Must | Test truy cập không JWT, sai vai trò, truy cập đơn người khác đều bị từ chối. |
| NFR-03 | Tích hợp | Kiểm tra chữ ký VNPay, số tiền, mã giao dịch; không để lộ bí mật. | Must | Test IPN sai chữ ký/giá trị; secret không có trong repo hay log. |
| NFR-04 | Toàn vẹn dữ liệu | Cập nhật thanh toán, nguyên liệu, điểm và trạng thái cần transaction/idempotency. | Must | Có integration test gửi lặp/đồng thời và xác nhận không trừ/hoàn kho hoặc cộng/bù điểm hai lần. |
| NFR-05 | Khả dụng | Next.js theo hướng mobile-first/PWA và có loading/empty/error states. | Must | Test màn hình di động và trạng thái mất/kém kết nối ở mức giao diện; không cam kết offline thanh toán. |
| NFR-06 | Khả năng bảo trì | Module NestJS rõ trách nhiệm; migration/seed tái tạo dữ liệu. | Must | Có tài liệu cấu trúc module; chạy migration/seed trên DB kiểm thử sạch thành công. |
| NFR-07 | Triển khai | Docker Compose chạy local; CI lint/test/build; môi trường bàn giao qua HTTPS và health endpoint. | Must | Chạy được lệnh hướng dẫn; có minh chứng CI và truy cập `/health`. |
| NFR-08 | Quan sát & đối soát | Lưu log/sự kiện quan trọng và khả năng tìm giao dịch lỗi. | Must | Có thể tìm theo order/payment; không log khóa bí mật, token hoặc dữ liệu ngân hàng nhạy cảm. |
| NFR-09 | Kiểm thử | Có unit, integration, ít nhất một E2E của luồng menu → thanh toán → đơn. | Must | Test bao phủ cả thành công, thất bại, trùng lặp, quá hạn và hủy đơn; ghi nhận kết quả chạy. |
| NFR-10 | Truy vết | Mỗi yêu cầu quan trọng liên kết được UC, sơ đồ, API và test. | Must | Có ma trận truy vết trong `docs/traceability-matrix.md` ở giai đoạn bàn giao. |

## 5. Quy tắc nghiệp vụ xuyên suốt

| Mã | Quy tắc |
|---|---|
| BR-01 | Chỉ VNPay Sandbox; không có tiền mặt/COD, ví hoặc thẻ mô phỏng độc lập. |
| BR-02 | Tạo đơn `PENDING` **không trừ nguyên liệu**; chỉ xác nhận thanh toán hợp lệ mới thực hiện cập nhật nguyên liệu và điểm trong transaction. |
| BR-03 | Đơn chờ thanh toán **15 phút tính từ lúc tạo Order**. Thời hạn Payment Attempt không vượt quá hạn Order; lượt thanh toán mới không gia hạn Order. |
| BR-04 | Đơn/giao dịch có kết quả VNPay chưa xác định phải được đối soát; Return URL không phải bằng chứng thanh toán. |
| BR-05 | Customer chỉ hủy đơn mình khi `PENDING`, `PAYMENT_FAILED`, `PAID` và chưa pha; Staff chỉ hủy `PAID` chưa pha, phải có lý do. |
| BR-06 | Đơn `PREPARING` trở đi không được hủy; `CANCELLED` không chuyển lại trạng thái hoạt động. |
| BR-07 | Hủy đơn đã PAID: hoàn nguyên liệu theo bản ghi trừ kho và điều chỉnh điểm, đều **đúng một lần**. |
| BR-08 | Bù giá trị VNPay đã trả bằng điểm BrewLite theo `ceil(VND / 100)`; không đồng nghĩa với VNPay Refund; điểm đã dùng giảm giá được trả lại riêng. |
| BR-09 | Chống trùng thanh toán/IPN/hủy/hoàn kho/điểm. Không đồng thời thực hiện hoàn VNPay cũ và bù điểm trùng giá trị cho một giao dịch. |
| BR-10 | Điểm thưởng thông thường được tính theo chính sách tích điểm của hệ thống, tách biệt với điểm bù khi hủy (1 điểm bù = 100 VND); mọi biến động điểm được ghi sổ đúng một lần. |
| BR-11 | Nếu giao dịch VNPay được xác minh thành công **sau khi đơn đã `CANCELLED`**, không mở lại đơn, không trừ nguyên liệu, không cộng điểm thưởng thông thường; ghi nhận tiền đã trả trong ledger đối soát, xử lý bù điểm đúng một lần sau khi loại trừ refund VNPay cũ. |
| BR-12 | Nếu VNPay thành công nhưng **không đủ nguyên liệu** để xử lý đơn, không ghi `PAID` như đơn đủ điều kiện pha; lưu trạng thái ngoại lệ để đối soát, không xuất kho/cộng điểm thường và thực hiện bù theo số VNPay đã trả sau khi xác minh không có refund trùng. |
| BR-13 | `PAYMENT_FAILED` là trạng thái nghiệp vụ Order khi lượt thanh toán gần nhất thất bại đã xác minh; đơn vẫn dùng hạn 15 phút tính từ lúc tạo và có thể thử lại nếu chưa hết hạn. Payment Attempt có trạng thái độc lập (`PENDING`, `SUCCEEDED`, `FAILED`, `UNKNOWN`, `EXPIRED`). |

## 6. Danh mục Use Case tổng quát và truy vết

Sơ đồ Use Case tổng quát mô tả **mục tiêu bên ngoài hệ thống** bằng 20 hình oval, không cố gắng vẽ mọi bước xử lý nội bộ. Các chức năng có mục đích khác nhau (đăng ký/đăng nhập, xem điểm/sử dụng điểm, xem lịch sử/theo dõi trạng thái) được tách riêng. **Quản lý giỏ hàng** được giữ như một mục tiêu tổng quát; thêm/sửa/xóa món là các bước bên trong Use Case đó và sẽ chi tiết hóa khi đặc tả.

| Mã | Use Case | Tác nhân | Yêu cầu liên quan |
|---|---|---|---|
| UC-01 | Đăng ký tài khoản | Customer | FR-04 |
| UC-02 | Đăng nhập | Customer, Staff, Manager | FR-04 |
| UC-03 | Xem thực đơn | Customer | FR-01 |
| UC-04 | Xem chi tiết sản phẩm | Customer | FR-02 |
| UC-05 | Quản lý giỏ hàng | Customer | FR-03 |
| UC-06 | Tạo đơn hàng | Customer | FR-05, FR-06, FR-07 |
| UC-07 | Xem điểm BrewLite | Customer | FR-22 |
| UC-08 | Sử dụng điểm BrewLite | Customer | FR-22 |
| UC-09 | Thanh toán VNPay | Customer, VNPay Sandbox | FR-08–FR-13 |
| UC-10 | Xem kết quả thanh toán | Customer | FR-14 |
| UC-11 | Xem lịch sử đơn | Customer | FR-23 |
| UC-12 | Theo dõi trạng thái đơn | Customer | FR-23 |
| UC-13 | Hủy đơn hàng | Customer | FR-15, FR-17–FR-20 |
| UC-14 | Xem đơn cửa hàng | Staff, Manager | FR-24 |
| UC-15 | Xác nhận đơn hàng | Staff, Manager | FR-24 |
| UC-16 | Cập nhật tiến độ đơn | Staff, Manager | FR-24 |
| UC-17 | Hủy đơn trước khi pha | Staff, Manager | FR-16–FR-20 |
| UC-18 | Quản lý sản phẩm | Manager | FR-25 |
| UC-19 | Quản lý nguyên liệu | Manager | FR-21, FR-25 |
| UC-20 | Quản lý công thức | Manager | FR-21 |

**Quy ước sơ đồ:** Hình người là actor, hình oval là Use Case, khung chữ nhật là ranh giới hệ thống BrewLite; đường liền là liên kết *association*. `UC-02` dùng chung cho ba vai trò, không tạo ba bản sao đăng nhập. `VNPay Sandbox «Payment Service»` là hệ thống ngoài, liên kết với `UC-09`. `Manager` được dùng các chức năng vận hành của Staff theo phân quyền mô tả trong SRS.

**Không tách thành oval riêng trên sơ đồ tổng quát:** kiểm tra chữ ký IPN, chống lặp, đếm 15 phút, trừ/hoàn nguyên liệu, bù/thu hồi điểm và ghi log. Đây là điều kiện/hậu xử lý của các UC có liên quan, đặc tả trong FR/BR và sơ đồ Activity/Sequence ở Task khác.

## 7. Ngoài phạm vi

- Không có tiền mặt/COD, ví giả lập hoặc thanh toán sản xuất với tiền thật.
- Không hỗ trợ giao hàng, nhiều chi nhánh hay hệ thống kế toán độc lập.
- Không cho phép hủy từ thời điểm bắt đầu pha chế (`PREPARING`) trở đi.
- Không phát triển luồng VNPay Refund mới trong phạm vi đã lựa chọn **bù bằng điểm BrewLite**; giao dịch hoàn tiền cũ (nếu có) phải được đối soát để không cấp quyền lợi trùng.

## 8. Điểm cấu hình cần xác nhận trong vòng review

- **Tỷ lệ tích điểm thưởng thông thường:** Task 1.1 chỉ chốt tỷ lệ *bù khi hủy* là 1 điểm/100 VNĐ. Tỷ lệ *tích điểm khi thanh toán thành công* chưa được chốt trong Task 1.1, vì vậy SRS yêu cầu cơ chế tích điểm có thể cấu hình và ghi sổ; không khẳng định một tỷ lệ chưa được duyệt.
- **Thời hạn một lượt VNPay:** Task 1.1 chốt **15 phút cho toàn bộ đơn**, không đồng nghĩa 15 phút cho mỗi URL. Mỗi lượt thanh toán không được kéo dài quá hạn đơn; nếu sử dụng 5 phút/lượt thì cần xác nhận thành quyết định chung khi review.
- **Trường hợp bất thường:** VNPay thành công đến muộn hoặc kho không đủ phải được ghi nhận/đối soát và xử lý bù điểm theo BR-08–BR-12, tuyệt đối không coi Return URL là xác nhận thành công hoặc cấp bù lặp.

## 9. Checklist nghiệm thu Task 1.2

- [ ] FR-01 đến FR-26 có mã, mức ưu tiên MoSCoW và Acceptance Criteria có thể kiểm chứng.
- [ ] NFR-01 đến NFR-10 có mã, mức ưu tiên MoSCoW và Acceptance Criteria.
- [ ] 20 mã UC trong SRS khớp 20 oval của sơ đồ Use Case tổng quát.
- [ ] Bốn actor: Customer, Staff, Manager, VNPay Sandbox; đúng ranh giới hệ thống, đường nối UML.
- [ ] Có `docs/diagrams/sources/use-case-overview.drawio` và `docs/diagrams/exports/use-case-overview.svg` từ cùng một bản sơ đồ.
- [ ] Hiển review các điểm cấu hình chưa chốt trước khi merge PR của Hiệp vào `develop`.

> **Trạng thái:** Tài liệu yêu cầu để review; không xác nhận các FR/NFR đã được triển khai hoặc kiểm thử thành công.
