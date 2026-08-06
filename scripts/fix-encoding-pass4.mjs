import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const filePath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "App.tsx");
let content = readFileSync(filePath, "utf8");

const replacements = [
  ["Tổng tiền c?n ??n", "Tổng tiền cần đến"],
  ["Kho?n c? ??nh ch? tính khi tick đã chuy?n", "Khoản cố định chỉ tính khi tick đã chuyển"],
  ["M?c", "Mục"],
  ["Nhập tài sĐn, giá và số tiền nhận hợp lệ.", "Nhập tài sản, giá và số tiền nhận hợp lệ."],
  ["SĐ BTC rút lĐn hon số BTC Đang có.", "Số BTC rút lớn hơn số BTC đang có."],
  ["SĐ USDT rút lĐn hon số du USDT.", "Số USDT rút lớn hơn số dư USDT."],
  ["Giá v?n TB", "Giá vốn TB"],
  ["v?n BTC ch?a ??i", "vốn BTC chưa đổi"],
  ["USDT th?c nh?n", "USDT thực nhận"],
  ["Ngày b?t ??u k? ho?ch", "Ngày bắt đầu kế hoạch"],
  ["Ngày b?t ??u", "Ngày bắt đầu"],
  ["Giá g?n nh?t", "Giá gần nhất"],
  ["BTC Gói ??nh k?", "BTC Gói định kỳ"],
  ["Số tiền ??u t?", "Số tiền đầu tư"],
  ["S? l??ng n?m gi?", "Số lượng nắm giữ"],
  ["Th?i gian kích ho?t", "Thời gian kích hoạt"],
  ["U?c tính", "Ước tính"],
  ["Số tiền nh?n", "Số tiền nhận"],
  ["Ch? ghi l?ch s?", "Chỉ ghi lịch sử"],
  ["Rút kh?i qu?", "Rút khỏi quỹ"],
  ["Nhập mã cổ phiếu truĐc khi dùng Max.", "Nhập mã cổ phiếu trước khi dùng Max."],
  ["Nhập ít nhĐt mặt mã cổ phiếu hợp lệ.", "Nhập ít nhất một mã cổ phiếu hợp lệ."],
  ["Tổng giá trĐ mua Đang vuĐt quá tiền được CK.", "Tổng giá trị mua đang vượt quá tiền mặt CK."],
  ["Số cổ phiếu rút lĐn hon số Đang có.", "Số cổ phiếu rút lớn hơn số đang có."],
  ["Nhập từ lĐ hoặc số cổ nhận hợp lệ.", "Nhập tỷ lệ hoặc số cổ nhận hợp lệ."],
  ["Số cổ phi?u rút", "Số cổ phiếu rút"],
  ["Số cổ phi?u", "Số cổ phiếu"],
  ["Loại sổ ki?n", "Loại sự kiện"],
  ["Ngày nh?n", "Ngày nhận"],
  ["Số cổ ?? quy?n", "Số cổ đủ quyền"],
  ["Số cổ ???c mua", "Số cổ được mua"],
  ["B?m ??u tick ???c ?n thông báo", "Bấm đầu tick được ẩn thông báo"],
  ["S? ki?n", "Sự kiện"],
  ["C? phi?u", "Cổ phiếu"],
  ["V?n / Th? tru?ng", "Vốn / Thị trường"],
  ["Đ?i soát", "Đối soát"],
  ["Tài kho?n", "Tài khoản"],
  ["M? l?i", "Mở lại"],
  ["Lưu l?i", "Lưu lại"],
  ["Đã c?p nh?t", "Đã cập nhật"],
  ["T?t c? m?c", "Tất cả mục"],
  ["T?o s?", "Tạo sổ"],
  ["T?o t?", "Tạo từ"],
  ["Giá tr? cu?i k?", "Giá trị cuối kỳ"],
  ["K? h?n tháng", "Kỳ hạn tháng"],
  ["Ngày dáo h?n", "Ngày đáo hạn"],
  ["Lãi su?t", "Lãi suất"],
  ["G?i ", "Gửi "],
  ["Đáo h?n", "Đáo hạn"],
  ["g?c ", "gốc "],
  [" · g?c ", " · gốc "],
];

for (const [from, to] of replacements) {
  content = content.split(from).join(to);
}

writeFileSync(filePath, content, "utf8");
console.log("Fixed encoding pass 4.");
