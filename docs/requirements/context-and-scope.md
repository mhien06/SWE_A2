# Task 1.1 – Bối cảnh, stakeholder và phạm vi hệ thống BrewLite

> **Dự án:** BrewLite – Assignment 2  
> **Người thực hiện:** Nguyễn Minh Hiển  
> **Người review:** Nguyễn Chí Thành  
> **Trạng thái:** Bản nháp để nhóm rà soát trước khi nghiệm thu Task 1.1

## 1. Bối cảnh và vấn đề nghiệp vụ

BrewLite là hệ thống hỗ trợ quy trình đặt đồ uống của một cửa hàng, từ xem thực đơn, lựa chọn kích cỡ và topping, quản lý giỏ hàng, đặt đơn, thanh toán đến theo dõi trạng thái xử lý. Hệ thống hướng tới việc giảm thao tác thủ công tại quầy, giúp khách hàng nắm được thông tin đơn hàng và hỗ trợ nhân viên xử lý đơn rõ ràng, nhất quán.

Trong thực tế, quy trình đặt đồ uống có thể phát sinh các tình huống như khách không hoàn tất thanh toán, thanh toán gửi thông báo lặp, khách yêu cầu hủy khi cửa hàng chưa pha chế hoặc số lượng nguyên liệu thay đổi. Nếu chỉ cập nhật trạng thái đơn mà không kiểm soát giao dịch, nguyên liệu và điểm thưởng, hệ thống có nguy cơ ghi nhận sai tồn kho hoặc xử lý trùng quyền lợi của khách hàng.

BrewLite được xây dựng theo hướng ứng dụng web mobile-first/PWA, sử dụng Next.js cho giao diện, NestJS cho API và PostgreSQL để lưu trữ dữ liệu. Ở phạm vi bài tập, hệ thống tích hợp **VNPay Sandbox**(Payment Service) cho hoạt động thanh toán thử nghiệm; không xử lý tiền thật.

## 2. Mục tiêu của hệ thống

- Cung cấp trải nghiệm đặt đồ uống trực tuyến đơn giản, sử dụng được trên điện thoại.
- Cho phép khách hàng xem menu, chọn tùy chọn, đặt đơn, thanh toán và theo dõi đơn hàng.
- Hỗ trợ nhân viên tiếp nhận, xác nhận và cập nhật tiến độ pha chế của đơn.
- Quản lý thời hạn chờ thanh toán, xử lý đơn hết hạn và tránh ghi nhận thanh toán trùng.
- Quản lý nguyên liệu theo công thức đồ uống, chỉ ghi giảm nguyên liệu khi thanh toán được xác minh thành công.
- Hỗ trợ hủy đơn hợp lệ trước khi pha, hoàn nguyên liệu đúng một lần và điều chỉnh điểm thưởng.
- Ghi nhận điểm BrewLite cho khách hàng; sử dụng điểm để giảm giá và bù giá trị thanh toán VNPay Sandbox cho trường hợp hủy hợp lệ theo quy tắc nhóm thống nhất.
- Đảm bảo có khả năng kiểm thử, truy vết yêu cầu và triển khai theo quy trình của Assignment 2.

## 3. Các bên liên quan (Stakeholder)

| Stakeholder | Vai trò | Mục tiêu và kỳ vọng |
|---|---|---|
| Khách hàng (Customer) | Xem menu, đặt hàng, thanh toán và theo dõi đơn | Thao tác dễ dàng; biết trạng thái thanh toán và đơn; có thể hủy trong điều kiện cho phép; điểm thưởng được ghi nhận minh bạch |
| Nhân viên quầy (Staff) | Tiếp nhận, xác nhận và xử lý đơn | Nhìn rõ đơn đã thanh toán; thao tác cập nhật trạng thái; hủy đơn hợp lệ trước khi pha kèm lý do |
| Quản lý cửa hàng (Manager) | Quản lý thực đơn, vận hành và quyền truy cập | Kiểm soát sản phẩm, nguyên liệu, xử lý đơn và dữ liệu vận hành nhất quán |
| Giảng viên/khách hàng nghiệm thu | Đánh giá bài tập và sản phẩm | Có tài liệu, sơ đồ, code, kiểm thử, CI/CD, demo và khả năng truy vết rõ ràng |
| Nhóm phát triển | Phân tích, thiết kế, lập trình, kiểm thử và triển khai | Phân công rõ; quản lý công việc bằng Issue/PR; duy trì chất lượng và khả năng bảo trì |
| VNPay Sandbox | Hệ thống thanh toán thử nghiệm bên ngoài BrewLite | Giao tiếp theo giao thức tích hợp, có xác minh kết quả và xử lý thông báo trùng đúng quy định |

## 4. Phạm vi thực hiện (In-scope)

### 4.1. Chức năng nền tảng

1. Đăng ký, đăng nhập, xác thực JWT và phân quyền Customer/Staff/Manager.
2. Xem thực đơn và chi tiết sản phẩm; chọn size, topping và số lượng.
3. Quản lý giỏ hàng và hiển thị số tiền tạm tính; backend tính lại số tiền chính thức khi tạo đơn.
4. Tạo đơn, lưu chi tiết và tổng tiền; theo dõi lịch sử và trạng thái đơn.
5. Nhân viên tiếp nhận, xác nhận và cập nhật tiến độ pha chế.

### 4.2. Thanh toán và thời hạn đơn

1. **Chỉ sử dụng VNPay Sandbox** cho thanh toán mô phỏng.
2. Khi khách tạo đơn hợp lệ, đơn chuyển trạng thái **`PENDING`**, chưa trừ kho nguyên liệu.
3. **Đơn `PENDING` được chờ tối đa 15 phút kể từ lúc tạo đơn**. Nếu chưa có thanh toán thành công hợp lệ khi hết hạn, hệ thống xử lý tự hủy; trường hợp kết quả giao dịch vẫn chưa xác định phải đối soát trước khi chốt xử lý để tránh ghi nhận sai.
4. Khi backend xác minh thanh toán thành công, hệ thống chuyển đơn sang **`PAID`**, ghi giảm nguyên liệu theo công thức và cộng điểm thưởng **đúng một lần**.
5. Thanh toán thất bại đã xác minh được ghi nhận để khách có thể thực hiện lần thanh toán lại hợp lệ khi đơn chưa hết hạn.
6. Các lần yêu cầu thanh toán và thông báo kết quả gửi trùng được kiểm soát bằng mã định danh/idempotency; Return URL chỉ phục vụ điều hướng/hiển thị, không tự quyết định thanh toán thành công.

### 4.3. Hủy đơn, tồn kho nguyên liệu và điểm BrewLite

1. Khách hàng được hủy đơn của chính mình khi `PENDING`, `PAYMENT_FAILED` hoặc `PAID`, với điều kiện đơn chưa bắt đầu pha chế.
2. Nhân viên được hủy đơn `PAID` trước khi pha chế và phải nhập lý do hủy.
3. Từ trạng thái **`PREPARING`** trở đi, khách hàng và nhân viên không được hủy theo quy tắc trên. `CANCELLED` là trạng thái kết thúc.
4. Đơn chưa thanh toán chưa bị trừ nguyên liệu, vì vậy khi hủy **không phát sinh hoàn kho**.
5. Đơn đã thanh toán nếu hủy hợp lệ sẽ **hoàn đúng lượng nguyên liệu thực tế đã trừ và chỉ hoàn một lần**, đồng thời điều chỉnh số điểm đã cộng/đã dùng.
6. Đối với đơn đã thanh toán bằng VNPay Sandbox và hủy hợp lệ, BrewLite **bù giá trị VNPay đã trả bằng điểm** theo tỷ lệ **1 điểm = 100 VNĐ**, làm tròn lên. Điểm khách đã dùng để giảm giá được trả lại theo bản ghi sử dụng điểm.
7. Điểm bù là **quyền lợi trong hệ thống BrewLite, không phải tiền hoàn về tài khoản VNPay**. Các yêu cầu hoàn tiền VNPay từng có trong dữ liệu/luồng cũ, nếu tồn tại, phải được theo dõi riêng và ngăn bù hoặc hoàn trùng.

## 5. Ngoài phạm vi (Out-of-scope)

- Thanh toán tiền mặt/COD, ví giả lập hoặc thẻ giả lập độc lập với VNPay Sandbox.
- Xử lý giao dịch ngân hàng thật hoặc tích hợp VNPay môi trường production.
- Tạo thêm luồng hoàn tiền VNPay tự động trong phạm vi nghiệp vụ đã chọn bù bằng điểm, trừ khi nhóm phê duyệt một thay đổi phạm vi riêng.
- Hủy đơn sau khi đã bắt đầu pha chế (`PREPARING` trở đi).
- Các hệ thống kế toán, vận chuyển hoặc nhiều chi nhánh nếu không nằm trong SRS được phê duyệt.

## 6. Giả định và ràng buộc

| Nhóm | Nội dung |
|---|---|
| Công nghệ | Frontend Next.js mobile-first/PWA, backend NestJS, database PostgreSQL; hỗ trợ đóng gói/triển khai theo yêu cầu Assignment 2 |
| Thanh toán | Chỉ sử dụng VNPay Sandbox; mọi kết quả thành công/thất bại được backend xác minh |
| Thời gian | Mốc 15 phút là **thời hạn của đơn PENDING** từ lúc tạo đơn, không mặc nhiên là thời hạn của từng URL/attempt thanh toán |
| Tồn kho | Quản lý nguyên liệu theo công thức; thao tác trừ/hoàn cần đảm bảo tính nguyên tử và chống lặp |
| Điểm | Quy tắc **bù giá trị** là 1 điểm = 100 VNĐ, làm tròn lên; công thức **cộng điểm thưởng thông thường** cần được nhóm chốt trong SRS |
| Phân quyền | Khách chỉ thao tác với đơn của mình; nhân viên hủy đơn PAID chưa pha phải ghi lý do |
| Xung đột giao dịch | IPN đến muộn, giao dịch UNKNOWN, thanh toán cùng lúc với hủy hoặc thiếu nguyên liệu cần quy tắc an toàn, không xử lý tùy tiện |
| Quy trình dự án | Mọi tài liệu, sơ đồ và code phải có commit/PR, kiểm thử và truy vết tương ứng |

## 7. Rủi ro và hướng kiểm soát

| Rủi ro | Ảnh hưởng | Hướng kiểm soát |
|---|---|---|
| IPN gửi trùng hoặc đến muộn | Trừ kho, cộng điểm hoặc xác nhận đơn nhiều lần | Idempotency, khóa/transaction và đối soát trước khi chốt |
| Hết hạn 15 phút trong lúc VNPay chưa trả kết quả rõ ràng | Hủy nhầm đơn đã trả tiền | Tách trạng thái đơn và thanh toán; không xem UNKNOWN là thất bại |
| Thiếu nguyên liệu tại thời điểm xác nhận PAID | Đã thu tiền nhưng không thể thực hiện đơn | Kiểm tra và xử lý nguyên tử; xác định luồng xử lý ngoại lệ trong SRS/thiết kế |
| Hủy đơn đồng thời với nhân viên bắt đầu pha | Trạng thái đơn hoặc hoàn kho sai | Kiểm tra điều kiện trước pha trong transaction, chỉ một thao tác thắng |
| Bù điểm trùng với yêu cầu hoàn tiền VNPay cũ | Khách được bù nhiều lần | Lưu ledger/bản ghi đối chiếu giao dịch, bảo đảm một kết quả bù hợp lệ |
| Thiếu đồng nhất giữa SRS, UML và code | Khó nghiệm thu, kiểm thử sai | Ma trận truy vết FR → Use Case → sơ đồ → API → test |

## 8. Các điểm cần thống nhất trước Task 1.2

- Công thức **tích điểm thưởng thông thường** khi thanh toán thành công và quy tắc làm tròn.
- Cách xử lý giao dịch VNPay thành công nhưng đến sau khi đơn hết hạn hoặc đã hủy.
- Cách xử lý khi đã xác minh giao dịch thành công nhưng nguyên liệu không đủ để hoàn tất đơn.
- Cách phân biệt trạng thái đơn (`PENDING`, `PAID`, `PAYMENT_FAILED`, `PREPARING`, `CANCELLED`,...) với trạng thái giao dịch VNPay, để không dùng một enum cho hai vòng đời khác nhau.

## 9. Liên hệ với các Task tiếp theo

Tài liệu này là đầu vào cho Task 1.2 (SRS và Use Case tổng quát), Task 1.3 (đặc tả Use Case Đặt và thanh toán), Task 2 (Activity, Sequence, Domain Class Diagram), Task 3 (kiến trúc, ADR, Deployment) và các Task triển khai, kiểm thử sau đó.

> **Điều kiện nghiệm thu Task 1.1:** Đủ bối cảnh, stakeholder, in-scope, out-of-scope, giả định, ràng buộc và rủi ro; được reviewer kiểm tra; PR được chấp thuận. Không đánh dấu hoàn thành trước khi review.
