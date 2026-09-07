# PLAN UPDATE APP --- EXPENSE MANAGER / QUẢN LÝ KHOẢN CHI

## 0. Mục tiêu

Xây dựng một module **Expense Manager** tích hợp trực tiếp vào Dashboard
hiện tại để quản lý toàn bộ các khoản thuộc quỹ **Chi tiêu**.

Mục tiêu sử dụng thực tế:

-   Nhập khoản chi từ file XLSX sao kê ngân hàng.
-   Nhập khoản chi từ ảnh chụp màn hình sao kê bằng OCR.
-   Nhập nhanh khoản chi thủ công, đặc biệt cho tiền mặt hoặc các khoản
    nhỏ.
-   Mỗi giao dịch tiền ra là **một khoản chi riêng biệt**, không tự động
    gộp.
-   Cho phép người dùng tự tạo các danh mục như: Xăng, Nhớt, Ăn uống, Áo
    quần, Mua sắm...
-   Sau khi import XLSX/OCR, hiển thị các giao dịch để người dùng phân
    loại.
-   Có gợi ý phân loại dựa trên keyword/lịch sử nhưng **không tự động
    quyết định nếu chưa đủ chắc chắn**.
-   Có chống import trùng.
-   Có thể hoàn tác toàn bộ một lần import.
-   Có màn hình tổng hợp theo danh mục, ngày, tuần, tháng.
-   Dashboard và Expense Manager phải dùng **cùng một nguồn dữ liệu
    Expense Ledger**, không được tạo hai số liệu độc lập.
-   Page mới được mở ngay từ Dashboard bằng nút cạnh bộ chuyển tháng.

------------------------------------------------------------------------

# 1. Quy tắc triển khai cho AI Agent

## 1.1. Trước khi code

AI Agent phải:

1.  Đọc toàn bộ source code hiện tại.
2.  Xác định framework, cấu trúc thư mục, state management, routing và
    database/storage hiện tại.
3.  Tìm cách Dashboard hiện đang lưu:
    -   Thu nhập.
    -   Chi tiêu.
    -   Tiết kiệm.
    -   Tháng hiện tại.
    -   Các giao dịch/quỹ hiện có.
4.  Không tự ý thay đổi kiến trúc hiện tại nếu chưa cần thiết.
5.  Tái sử dụng component, modal, button, card, typography, spacing và
    theme hiện có.
6.  Không tạo một hệ thống database/state thứ hai nếu app đã có
    persistence layer.
7.  Trước khi sửa logic quan trọng, xác định các file liên quan và phạm
    vi ảnh hưởng.

## 1.2. Nguyên tắc dữ liệu

**Expense Ledger là nguồn dữ liệu duy nhất cho khoản chi.**

Luồng:

``` text
XLSX
  \
   OCR/Parser -> Expense Ledger -> Classification -> Analytics
  /
Manual

Expense Ledger
     |
     +--> Dashboard
     +--> Expense Manager
     +--> Reports
```

Không được duy trì một `totalExpense` riêng cho Dashboard và một
`totalExpense` riêng cho Expense Manager.

------------------------------------------------------------------------

# 2. Dashboard --- thêm nút chuyển page

Dashboard hiện tại có bộ chuyển tháng ở phía trên:

``` text
THÁNG 09/2026                 [←] [Tháng 09/2026] [→]
```

Thêm nút:

``` text
[ Quản lý khoản chi ]
```

Khi click:

``` text
Dashboard
    ↓
Expense Manager
```

Khi đang ở Expense Manager:

``` text
[ ← Dashboard ]
```

để quay lại.

## 2.1. Đồng bộ tháng

Nếu Dashboard đang ở:

``` text
09/2026
```

thì khi mở Expense Manager phải hiển thị:

``` text
09/2026
```

Nếu đổi tháng trong Expense Manager, Dashboard khi quay lại phải sử dụng
đúng tháng đó.

Không được hard-code tháng.

Nên dùng state hiện tại của app, ví dụ:

``` text
currentMonth = YYYY-MM
```

tùy kiến trúc hiện tại.

------------------------------------------------------------------------

# 3. Expense Manager --- bố cục tổng thể

Page mới gồm:

``` text
Header
  |
  +-- Tên page
  +-- Bộ chuyển tháng
  +-- Nút về Dashboard

Overview
  |
  +-- Tổng chi
  +-- Số khoản
  +-- Chưa phân loại
  +-- Chi tiền mặt

Import / Add
  |
  +-- XLSX
  +-- Ảnh
  +-- Thủ công

Expense List
  |
  +-- Search
  +-- Filter
  +-- Danh sách giao dịch
  +-- Phân loại

Summary
  |
  +-- Theo danh mục
  +-- Theo ngày
  +-- Theo tuần
  +-- Theo tháng
```

Ưu tiên responsive theo giao diện hiện tại của app.

------------------------------------------------------------------------

# 4. ExpenseTransaction --- model dữ liệu

Tạo hoặc mở rộng model tương đương:

``` text
ExpenseTransaction {
    id

    date
    amount
    description

    categoryId

    paymentMethod

    source

    sourceFileId
    sourceImageId

    bankReference
    fingerprint

    status
    confidence

    createdAt
    updatedAt
}
```

## 4.1. source

Cho phép:

``` text
xlsx
image
manual
```

## 4.2. paymentMethod

Cho phép:

``` text
bank
cash
other
```

## 4.3. status

Cho phép:

``` text
unclassified
classified
ignored
duplicate
```

Có thể điều chỉnh enum/naming để phù hợp với codebase hiện tại.

------------------------------------------------------------------------

# 5. ExpenseCategory --- danh mục khoản chi

Model:

``` text
ExpenseCategory {
    id
    name
    icon
    color

    parentId?

    isActive

    keywords[]
}
```

Người dùng có thể:

-   Thêm danh mục.
-   Sửa danh mục.
-   Xóa/disable danh mục.
-   Thêm keyword cho danh mục.

Ví dụ:

``` text
Xăng
keywords:
- XANG
- XĂNG
- PETROL
- PVOIL
```

Các danh mục mẫu ban đầu có thể gồm:

``` text
Ăn uống
Xăng
Nhớt / Bảo dưỡng
Áo quần
Mua sắm
Đi lại
Học tập
Hóa đơn
Sức khỏe
Khác
```

Nhưng người dùng phải có thể tự chỉnh sửa.

Không bắt buộc sử dụng category con.

------------------------------------------------------------------------

# 6. Overview --- tổng quan tháng

Hiển thị 4 KPI thực dụng:

## 6.1. Tổng chi

Tổng tất cả `ExpenseTransaction.amount` thuộc tháng hiện tại và không ở
trạng thái ignored/duplicate.

Ví dụ:

``` text
Tổng chi
6.100.000đ
```

## 6.2. Số khoản

``` text
18 khoản
```

## 6.3. Chưa phân loại

``` text
7 khoản
```

Click vào KPI này phải lọc danh sách sang:

``` text
status = unclassified
```

## 6.4. Tiền mặt

Tổng các khoản:

``` text
paymentMethod = cash
```

------------------------------------------------------------------------

# 7. Nhập thủ công

Tạo form nhập nhanh.

Fields tối thiểu:

``` text
Ngày
Số tiền
Nội dung
Danh mục
Phương thức
Ghi chú
```

UI:

``` text
Thêm khoản chi

Ngày
[ 06/09/2026 ]

Số tiền
[ 50.000 ]

Nội dung
[ Đổ xăng ]

Danh mục
[ Xăng ▼ ]

Phương thức
○ Ngân hàng
● Tiền mặt

Ghi chú
[................]

[ Hủy ] [ Thêm khoản chi ]
```

## 7.1. Quy tắc

-   Ngày mặc định là ngày hiện tại nhưng cho phép sửa.
-   Số tiền bắt buộc \> 0.
-   Nội dung có thể để trống nếu app hiện tại cho phép.
-   Nếu chọn `cash`, thống kê vào tiền mặt.
-   Source luôn là `manual`.
-   Status:
    -   Có category -\> `classified`.
    -   Không category -\> `unclassified`.

Không bắt người dùng nhập quá nhiều trường.

------------------------------------------------------------------------

# 8. Import XLSX

## 8.1. Flow

``` text
Chọn XLSX
    ↓
Đọc file
    ↓
Nhận diện column
    ↓
Tìm giao dịch
    ↓
Chỉ lấy tiền ra
    ↓
Preview
    ↓
Kiểm tra duplicate
    ↓
User xác nhận
    ↓
Import
```

## 8.2. Không hard-code format ngân hàng

File XLSX có thể có:

``` text
Ngày giao dịch
Ngày hạch toán
Số tiền
Ghi nợ
Ghi có
Nội dung
Diễn giải
Số dư
```

Phải có cơ chế mapping cột.

Ví dụ:

``` text
Ngày       -> Ngày giao dịch
Số tiền    -> Ghi nợ
Nội dung   -> Diễn giải
```

Nếu không xác định được:

``` text
Không xác định được cột số tiền

[ Chọn cột ]
```

## 8.3. Lưu template mapping

Nếu có thể, lưu mapping theo tên/ngữ cảnh ngân hàng để lần sau tự nhận
diện.

Ví dụ:

``` text
MB Bank
Ngày -> column B
Debit -> column D
Description -> column E
```

Không bắt buộc biết tên ngân hàng nếu file không cung cấp.

------------------------------------------------------------------------

# 9. Logic xác định khoản chi từ XLSX

Mỗi giao dịch tiền ra = 1 ExpenseTransaction.

Ví dụ:

``` text
+10.000.000
-30.000
-139.000
-288.000
+1.255.000
```

Chỉ tạo:

``` text
-30.000
-139.000
-288.000
```

Không tạo giao dịch cho tiền vào.

Ưu tiên xác định theo cột debit/credit nếu file có cấu trúc rõ ràng.

Nếu file chỉ có một cột amount với số âm/dương:

``` text
amount < 0 -> expense
amount > 0 -> ignore
```

Nếu format không rõ ràng, phải yêu cầu mapping/xác nhận thay vì đoán.

------------------------------------------------------------------------

# 10. Preview XLSX

Sau khi parse:

``` text
Đã tìm thấy 42 khoản chi

☑ 06/09   -30.000    CUSTOMER MB...
☑ 06/09  -139.000    Mã giao dịch...
☑ 06/09  -288.000    MBCT...
☑ 06/09   -23.500    QR CODE...

Đã chọn: 42 khoản
Tổng: 4.325.500đ

[ Hủy ]       [ Import 42 khoản ]
```

Yêu cầu:

-   Cho chọn/bỏ chọn từng giao dịch.
-   Select all.
-   Hiển thị tổng tiền.
-   Hiển thị số lượng.
-   Cho sửa ngày/số tiền/nội dung nếu parser đọc sai trước khi import.
-   Các giao dịch nghi ngờ duplicate phải được đánh dấu.

------------------------------------------------------------------------

# 11. Duplicate Detection

Không được import trùng khi người dùng upload lại cùng sao kê.

Tạo fingerprint từ các trường ổn định:

``` text
date
amount
description
bankReference
```

Ví dụ:

``` text
2026-09-06
-139000
Mã giao dịch...
reference...
```

=\> fingerprint.

Nếu fingerprint đã tồn tại:

``` text
⚠ Có khả năng đã tồn tại
```

Cho phép:

``` text
[ Bỏ qua ]
```

hoặc xử lý thủ công nếu cần.

Không được dựa duy nhất vào `id` để chống duplicate.

------------------------------------------------------------------------

# 12. Import Session + Undo

Tạo model tương đương:

``` text
ExpenseImportSession {
    id

    source
    fileName

    importedAt

    totalDetected
    totalImported
    totalSkipped
    totalDuplicate

    status
}
```

Mỗi transaction import phải liên kết với session.

Sau import:

``` text
Đã import 39/42 khoản

[ Hoàn tác lần nhập ]
```

Nếu user chọn undo:

-   Xóa/rollback toàn bộ transactions được tạo bởi session.
-   Không xóa transactions cũ.
-   Không xóa transactions đã tồn tại trước đó.

Có thể hiển thị lịch sử import:

``` text
Lịch sử nhập

06/09/2026
MB_01-09.xlsx
42 phát hiện
39 đã nhập
3 trùng

[ Xem ] [ Hoàn tác ]
```

------------------------------------------------------------------------

# 13. OCR từ ảnh chụp màn hình

## 13.1. Flow

``` text
Chọn ảnh
    ↓
OCR
    ↓
Detect transaction blocks
    ↓
Extract date
    ↓
Extract amount
    ↓
Extract description
    ↓
Detect tiền ra
    ↓
Preview
    ↓
User xác nhận
    ↓
Import
```

## 13.2. Không tin OCR tuyệt đối

Nếu OCR confidence thấp hoặc dữ liệu bất thường:

``` text
⚠ Kiểm tra lại

Ngày:
06/09/2026

Số tiền:
139.000đ

Nội dung:
CUSTOMER MBCT...
```

Cho phép sửa.

## 13.3. Một giao dịch = một khoản chi

Ảnh:

``` text
-30.000
-139.000
-288.000
-23.500
-102.000
```

phải tạo 5 transactions.

Không gộp.

## 13.4. Lưu source

Transaction từ ảnh:

``` text
source = image
sourceImageId = ...
```

Nếu hệ thống hiện tại không lưu ảnh, có thể chỉ lưu import metadata tùy
khả năng storage.

------------------------------------------------------------------------

# 14. Classification --- phân loại khoản chi

Đây là chức năng được sử dụng thường xuyên nhất sau import.

Danh sách:

``` text
7 khoản chưa phân loại

06/09   -30.000   QR CODE...
[ Chưa phân loại ▼ ]

06/09  -139.000   Mã giao dịch...
[ Chưa phân loại ▼ ]

06/09  -288.000   CUSTOMER...
[ Chưa phân loại ▼ ]
```

Dropdown:

``` text
Ăn uống
Xăng
Nhớt
Áo quần
Mua sắm
Đi lại
Học tập
Khác
```

Sau khi chọn category:

``` text
status = classified
categoryId = selectedCategory
```

------------------------------------------------------------------------

# 15. Bulk Classification

Phải cho phép chọn nhiều giao dịch:

``` text
☑ -30.000
☑ -23.500
☑ -102.000

[ Phân loại thành... ]
```

Chọn:

``` text
Xăng
```

=\> cả 3 transaction được gán category `Xăng`.

Mục tiêu: xử lý nhanh 20--50 giao dịch sau mỗi lần import.

------------------------------------------------------------------------

# 16. Category Suggestion

Không cần AI phức tạp ở version đầu.

Dùng:

``` text
category keywords
+
merchant mapping
+
lịch sử phân loại
```

Ví dụ:

``` text
"XĂNG DẦU"
```

=\> gợi ý:

``` text
💡 Xăng
```

``` text
GRAB
```

=\>:

``` text
💡 Đi lại
```

``` text
LOTTE MART
```

=\>:

``` text
💡 Mua sắm
```

Gợi ý chỉ là suggestion.

Không tự động phân loại khi confidence không đủ cao.

------------------------------------------------------------------------

# 17. Learning từ lịch sử

Khi user phân loại:

``` text
"GRAB"
-> Đi lại
```

lưu mapping.

Lần sau gặp:

``` text
GRAB
```

gợi ý:

``` text
Đi lại
```

Ưu tiên:

1.  Merchant mapping đã được user xác nhận.
2.  Keyword của category.
3.  Lịch sử phân loại.
4.  Nếu không đủ chắc chắn -\> Chưa phân loại.

Không cần machine learning ở version đầu.

------------------------------------------------------------------------

# 18. Expense List

Danh sách cần hỗ trợ:

-   Search theo nội dung.
-   Filter theo category.
-   Filter theo payment method.
-   Filter theo source.
-   Filter theo status.
-   Filter theo khoảng ngày.
-   Sort theo ngày.
-   Sort theo số tiền.
-   Edit transaction.
-   Delete transaction.

Các cột desktop:

``` text
Ngày
Nội dung
Số tiền
Danh mục
Phương thức
Nguồn
```

Mobile có thể chuyển thành card:

``` text
06/09/2026

QR CODE...
-102.000đ

Xăng
Ngân hàng
```

------------------------------------------------------------------------

# 19. Filter nhanh

Các filter nên có:

``` text
Tất cả
Chưa phân loại
Ngân hàng
Tiền mặt
XLSX
Ảnh
Thủ công
```

Filter category:

``` text
Tất cả
Ăn uống
Xăng
Nhớt
...
```

Mục tiêu là giảm số thao tác khi kiểm tra dữ liệu.

------------------------------------------------------------------------

# 20. Summary --- tổng hợp khoản chi

## 20.1. Theo danh mục

Ví dụ:

``` text
Ăn uống       1.350.000đ   22,1%
Mua sắm         950.000đ   15,6%
Học tập       1.300.000đ   21,3%
Đi lại          435.000đ    7,1%
Xăng            560.000đ    9,2%
Khác          1.505.000đ   24,7%
```

Tổng phải khớp Expense Ledger.

## 20.2. Theo ngày

``` text
01/09   250.000đ
02/09   430.000đ
03/09   120.000đ
04/09   850.000đ
05/09   180.000đ
06/09 1.250.000đ
```

Có thể dùng bar chart nếu UI hiện tại đã có chart component.

## 20.3. Theo tuần

``` text
Tuần 1    1.350.000đ
Tuần 2    1.850.000đ
Tuần 3    1.120.000đ
Tuần 4    1.780.000đ
```

## 20.4. So sánh tháng

``` text
                08/2026       09/2026       +/- 

Ăn uống         1.100.000     1.350.000    +250k
Xăng              420.000       560.000    +140k
Mua sắm           800.000       950.000    +150k
Đi lại             500.000       435.000     -65k
```

------------------------------------------------------------------------

# 21. Dashboard integration

Card hiện tại:

``` text
Chi tiêu
6.100.000đ
```

phải lấy từ Expense Ledger.

Không hard-code hoặc cộng từ một nguồn dữ liệu khác.

Ví dụ:

``` text
Expense Ledger
      ↓
getExpenses(currentMonth)
      ↓
sum(amount)
      ↓
Dashboard Chi tiêu
```

Expense Manager cũng gọi cùng logic:

``` text
getExpenses(currentMonth)
```

------------------------------------------------------------------------

# 22. Tích hợp với "Hôm nay cần làm gì"

Sau khi Expense Manager hoạt động, khu vực Dashboard:

``` text
Hôm nay cần làm gì
```

có thể hiển thị:

``` text
⚠ 7 khoản chi chưa phân loại
   582.500đ
   [ Phân loại ]

⚠ 1.350.743đ tiền CK chưa sử dụng
   [ Xem CK ]
```

Khi không còn khoản chưa phân loại:

``` text
✓ Tất cả khoản chi đã được phân loại
```

Không tạo notification gây phiền.

------------------------------------------------------------------------

# 23. Validation

## Transaction

-   amount \> 0.
-   date hợp lệ.
-   Không tạo transaction nếu parser không xác định được amount.
-   Transaction import từ XLSX/OCR phải qua preview.
-   Không duplicate theo fingerprint.

## Category

-   name không rỗng.
-   Không cho tạo category trùng tên nếu không cần thiết.
-   Không xóa category đang được sử dụng theo cách làm mất dữ liệu; ưu
    tiên disable/archive hoặc yêu cầu chuyển category.

## Import

-   File không đúng format -\> báo lỗi.
-   Không có transaction tiền ra -\> báo rõ.
-   Không xác định được column -\> yêu cầu mapping.
-   OCR không nhận diện được -\> cho phép retry hoặc nhập thủ công.

------------------------------------------------------------------------

# 24. Error handling

Không được để import lỗi làm crash app.

Các lỗi cần có message rõ:

``` text
Không thể đọc file XLSX.
```

``` text
Không xác định được cột số tiền.
```

``` text
Không tìm thấy giao dịch tiền ra.
```

``` text
Ảnh không đủ rõ để nhận diện giao dịch.
```

``` text
Không thể lưu dữ liệu. Vui lòng thử lại.
```

Không hiển thị stack trace cho user.

------------------------------------------------------------------------

# 25. Performance

Với XLSX lớn:

-   Không block UI.
-   Parse theo async/background nếu framework hỗ trợ.
-   Không render hàng nghìn row cùng lúc nếu không cần.
-   Dùng pagination/virtual list nếu danh sách lớn.

OCR cũng phải chạy async.

Trong lúc xử lý:

``` text
Đang đọc file...
```

hoặc:

``` text
Đang nhận diện giao dịch...
```

Không để UI đứng im.

------------------------------------------------------------------------

# 26. UX ưu tiên

Page này được thiết kế để sử dụng liên tục.

Ưu tiên:

1.  Import nhanh.
2.  Phân loại nhanh.
3.  Kiểm tra dữ liệu.
4.  Xem tổng chi.
5.  Tìm lại giao dịch.
6.  Nhập tiền mặt nhanh.

Không thêm các màn hình trang trí hoặc dashboard phụ không phục vụ
workflow.

------------------------------------------------------------------------

# 27. Không triển khai ở version đầu

Không làm các tính năng sau trong scope này:

-   Kết nối trực tiếp API ngân hàng.
-   Tự đăng nhập ngân hàng.
-   Tự tải sao kê online.
-   AI dự đoán tài chính.
-   AI phân tích tài chính phức tạp.
-   Budget system phức tạp.
-   Cảnh báo quá mức.
-   Machine learning model riêng.
-   Đồng bộ cloud nếu app hiện tại chưa có kiến trúc cho nó.

------------------------------------------------------------------------

# 28. Thứ tự triển khai

## PHASE 1 --- Core Expense Ledger

-   ExpenseTransaction model.
-   ExpenseCategory model.
-   CRUD.
-   Persistence.
-   Query theo tháng.
-   Tính tổng.
-   Liên kết Dashboard.

### Acceptance criteria

``` text
Tạo 3 khoản chi
-> Expense Manager hiển thị 3
-> Dashboard tổng chi tăng đúng.
```

------------------------------------------------------------------------

## PHASE 2 --- Manual Input

-   Form.
-   Cash/bank.
-   Edit.
-   Delete.
-   Category.
-   Validation.

### Acceptance criteria

``` text
Thêm khoản tiền mặt 50.000đ
-> Expense Manager có khoản.
-> Cash total tăng 50.000đ.
-> Dashboard tăng 50.000đ.
```

------------------------------------------------------------------------

## PHASE 3 --- XLSX Import

-   File picker.
-   XLSX parser.
-   Column mapping.
-   Detect debit.
-   Extract date.
-   Extract amount.
-   Extract description.
-   Preview.
-   Duplicate detection.
-   Import.
-   Import session.
-   Undo.

### Acceptance criteria

Một file có:

``` text
+10.000.000
-30.000
-139.000
-288.000
+1.255.000
```

phải tạo đúng:

``` text
3 ExpenseTransactions
```

------------------------------------------------------------------------

## PHASE 4 --- OCR

-   Image picker.
-   OCR.
-   Transaction detection.
-   Date detection.
-   Amount detection.
-   Description detection.
-   Debit detection.
-   Confidence.
-   Preview.
-   Edit.
-   Duplicate detection.
-   Import.

### Acceptance criteria

Ảnh có 5 khoản tiền ra:

``` text
5 transactions
```

được tạo sau khi user xác nhận.

------------------------------------------------------------------------

## PHASE 5 --- Classification

-   Category CRUD.
-   Dropdown.
-   Bulk classification.
-   Keyword.
-   Merchant mapping.
-   Suggestion.
-   Learning từ lịch sử.

### Acceptance criteria

``` text
20 giao dịch
7 chưa phân loại
```

User có thể xử lý 7 giao dịch mà không cần mở từng màn hình riêng.

------------------------------------------------------------------------

## PHASE 6 --- Analytics

-   Tổng theo category.
-   Tổng theo ngày.
-   Tổng theo tuần.
-   So sánh tháng.
-   Search.
-   Filter.
-   Top expenses.

------------------------------------------------------------------------

## PHASE 7 --- Dashboard integration

-   Button switch page.
-   Sync currentMonth.
-   Dashboard total.
-   Unclassified task.
-   Expense Manager back button.

------------------------------------------------------------------------

# 29. Test cases bắt buộc

## Test 1 --- Manual

``` text
Thêm 100.000đ ăn uống
```

Expected:

``` text
Expense total +100.000đ
Ăn uống +100.000đ
```

## Test 2 --- Cash

``` text
Thêm 50.000đ tiền mặt
```

Expected:

``` text
Cash total +50.000đ
```

## Test 3 --- XLSX

File:

``` text
+10.000.000
-30.000
-139.000
-288.000
```

Expected:

``` text
3 expenses
```

## Test 4 --- Duplicate

Import cùng file 2 lần.

Expected:

``` text
Lần 1: import
Lần 2: phát hiện duplicate
```

Tổng không bị nhân đôi.

## Test 5 --- OCR

Ảnh có:

``` text
-30.000
-139.000
-288.000
```

Expected:

``` text
3 expenses
```

## Test 6 --- Classification

Import 10 khoản.

Expected:

``` text
10 unclassified
```

Phân loại 4.

Expected:

``` text
6 unclassified
4 classified
```

## Test 7 --- Dashboard

Expense Manager:

``` text
6.100.000đ
```

Dashboard:

``` text
Chi tiêu = 6.100.000đ
```

Hai giá trị phải giống nhau.

## Test 8 --- Month isolation

Tháng 08 có:

``` text
1.000.000đ
```

Tháng 09 có:

``` text
2.000.000đ
```

Chuyển tháng không được cộng lẫn dữ liệu.

## Test 9 --- Undo import

Import 30 transactions.

Undo.

Expected:

``` text
30 transactions mới bị rollback
```

Các transaction cũ không bị ảnh hưởng.

------------------------------------------------------------------------

# 30. Definition of Done

Feature chỉ được xem là hoàn thành khi:

-   [ ] Dashboard có nút mở Expense Manager.
-   [ ] Có nút quay lại Dashboard.
-   [ ] Tháng được đồng bộ.
-   [ ] Expense Ledger là nguồn dữ liệu duy nhất.
-   [ ] Manual input hoạt động.
-   [ ] Cash tracking hoạt động.
-   [ ] XLSX import hoạt động.
-   [ ] Column mapping hoạt động.
-   [ ] Chỉ lấy giao dịch tiền ra.
-   [ ] Mỗi giao dịch = một ExpenseTransaction.
-   [ ] Preview trước import.
-   [ ] Duplicate detection hoạt động.
-   [ ] Import session hoạt động.
-   [ ] Undo import hoạt động.
-   [ ] OCR import hoạt động.
-   [ ] OCR có bước review/correction.
-   [ ] Category CRUD hoạt động.
-   [ ] Classification hoạt động.
-   [ ] Bulk classification hoạt động.
-   [ ] Keyword suggestion hoạt động.
-   [ ] Search/filter hoạt động.
-   [ ] Summary theo category hoạt động.
-   [ ] Summary theo ngày hoạt động.
-   [ ] Summary theo tuần hoạt động.
-   [ ] So sánh tháng hoạt động.
-   [ ] Dashboard total lấy từ Expense Ledger.
-   [ ] "Hôm nay cần làm gì" có thể hiển thị khoản chưa phân loại.
-   [ ] Không crash khi import file lỗi.
-   [ ] Có test cho duplicate.
-   [ ] Có test month isolation.
-   [ ] Có test undo import.

------------------------------------------------------------------------

# 31. Yêu cầu quan trọng cuối cùng cho AI Agent

Không được chỉ tạo UI mockup.

Feature phải được triển khai end-to-end:

``` text
UI
 ↓
State
 ↓
Parser/OCR
 ↓
Validation
 ↓
Persistence
 ↓
Expense Ledger
 ↓
Classification
 ↓
Analytics
 ↓
Dashboard
```

Sau mỗi phase:

1.  Chạy app.
2.  Test feature.
3.  Kiểm tra dữ liệu persistence.
4.  Kiểm tra Dashboard không bị sai.
5.  Kiểm tra các feature cũ không bị regression.
6.  Chỉ chuyển sang phase tiếp theo khi phase hiện tại hoạt động.

Nếu codebase hiện tại đã có model/service/component tương đương, **ưu
tiên mở rộng và tái sử dụng thay vì tạo bản duplicate**.

Nếu có điểm không rõ trong codebase, AI Agent phải kiểm tra source trước
khi quyết định kiến trúc; không tự suy đoán tên file, framework hoặc
API.
