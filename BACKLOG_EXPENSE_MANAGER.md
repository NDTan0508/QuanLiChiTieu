# Backlog — Expense Manager

## Release MVP (đã triển khai)

- [x] Mở rộng Expense Ledger hiện có với nguồn, phương thức, trạng thái, fingerprint và import session.
- [x] Migration dữ liệu cũ an toàn; dashboard và trang quản lý cùng dùng `expenseEntries`.
- [x] Trang Quản lý khoản chi, đồng bộ tháng với Dashboard và điều hướng hai chiều.
- [x] Nhập thủ công bank/cash, CRUD giao dịch, danh mục và phân loại hàng loạt.
- [x] Gợi ý danh mục bằng keyword; không tự động gán danh mục.
- [x] Nhập XLSX bằng SheetJS: tự nhận dạng MB Bank, mapping cột, preview/sửa dòng, chỉ lấy debit, chống trùng fingerprint và lưu mapping.
- [x] Lịch sử import cùng thao tác hoàn tác theo từng session.
- [x] KPI tổng chi, số khoản, chưa phân loại và tiền mặt; task Dashboard dẫn tới màn hình xử lý.

## P1 — Analytics mở rộng

- [x] Tổng hợp theo ngày, tuần và danh mục trên Expense Manager.
- [x] Bộ lọc nguồn, trạng thái, danh mục, phương thức và tìm kiếm.
- [ ] Thêm so sánh tháng trước và khoảng ngày tùy chỉnh.
- [ ] Thêm phân trang hoặc virtual list khi số giao dịch lớn.

## P2 — OCR riêng tư trên thiết bị

- [x] Thêm Tesseract.js chạy trong trình duyệt để nhận diện ảnh sao kê.
- [x] Tách các block “tiền ra” thành từng khoản và bắt buộc review/sửa trước import.
- [ ] Đóng gói language assets để lần nhận diện đầu không cần tải model OCR.

## Tiêu chí kiểm thử tiếp tục

- [ ] Unit test migration, month isolation, duplicate fingerprint, undo session và parser MB Bank.
- [ ] Test thủ công sao kê thật đã che dữ liệu nhạy cảm: credit bị bỏ qua, debit không bị gộp, import lại không nhân đôi tổng.
- [ ] Chạy `npm test` và `npm run build` cho mỗi release.
