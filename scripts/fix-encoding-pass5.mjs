import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const filePath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "App.tsx");
let content = readFileSync(filePath, "utf8");

const replacements = [
  ["từ lĐ phĐn trĐm", "tỷ lệ phần trăm"],
  ["SĐ du và lịch sử BTC sẽ được cập nhật lĐi.", "Số dư và lịch sử BTC sẽ được cập nhật lại."],
  ["SĐ du và lịch sử Crypto sẽ được cập nhật lĐi.", "Số dư và lịch sử Crypto sẽ được cập nhật lại."],
  ["stocksĐq=code", "stocks?q=code"],
  ["stocksĐsymbol", "stocks?symbol"],
  ["tính lĐi.", "tính lại."],
  ["cập nhật lĐi.", "cập nhật lại."],
  ["Chọn danh mục tài sĐn", "Chọn danh mục tài sản"],
  ["Chọn loĐi sĐ", "Chọn loại sổ"],
  ["K? h?n", "Kỳ hạn"],
  ["Lãi cu?i k?", "Lãi cuối kỳ"],
  ["Còn l?i", "Còn lại"],
  ["Ti?n lãi", "Tiền lãi"],
  ["Tạo sổ m?i", "Tạo sổ mới"],
  ["SĐ SOL rút lĐn hon số SOL Đang có.", "Số SOL rút lớn hơn số SOL đang có."],
  ["SĐ USDT lĐn hon số du USDT.", "Số USDT lớn hơn số dư USDT."],
  ["SĐ BTC lĐn hon số BTC Đang có.", "Số BTC lớn hơn số BTC đang có."],
  ["SOL s? h?u", "SOL sở hữu"],
  ["Giao d?ch SOL", "Giao dịch SOL"],
  ["Ti?n VND nh?n", "Tiền VND nhận"],
  ["Giá v?n trung bình", "Giá vốn trung bình"],
  ["V?n ban ??u", "Vốn ban đầu"],
  ["VND ???c", "VND dự"],
  ["Giá ti?n VND", "Giá tiền VND"],
  ["Giá tr? hi?n t?i", "Giá trị hiện tại"],
  ["Giao d?ch ti?p theo", "Giao dịch tiếp theo"],
  ["Ch?a có giao dịch Crypto.", "Chưa có giao dịch Crypto."],
  ["G?c ??u t?", "Gốc đầu tư"],
  ["% lãi/lĐ", "% lãi/lỗ"],
  ["Xem ngu?n ti?n", "Xem nguồn tiền"],
  ["B?o m?t và ?? li?u", "Bảo mật và dữ liệu"],
  [">?? li?u<", ">Dữ liệu<"],
  ["{trashItems.length} m?c", "{trashItems.length} mục"],
  ["USDT nh?n", "USDT nhận"],
  ["Ch?n m?c", "Chọn mục"],
  ["Đã kiĐm tra sĐc khĐe dữ liệu.", "Đã kiểm tra sức khỏe dữ liệu."],
  ["Tài khoĐn chưa tĐn tĐi. Vào /admin Đã tạo PIN.", "Tài khoản chưa tồn tại. Vào /admin để tạo PIN."],
  ["KĐt thúc mục ${goal.name}? Checklist từ tháng sau số không còn hiển thị mục này.", "Kết thúc mục ${goal.name}? Checklist từ tháng sau sẽ không còn hiển thị mục này."],
  ["Số BTC nh?n", "Số BTC nhận"],
  ["lĐn hon", "lớn hơn"],
  ["số du", "số dư"],
  ["SĐ ", "Số "],
  ["tài khoĐn", "tài khoản"],
  ["tĐn tĐi", "tồn tại"],
  ["kiĐm tra", "kiểm tra"],
  ["sĐc khĐe", "sức khỏe"],
  ["phĐn trĐm", "phần trăm"],
  ["loĐi", "loại"],
  ["tài sĐn", "tài sản"],
];

for (const [from, to] of replacements) {
  content = content.split(from).join(to);
}

writeFileSync(filePath, content, "utf8");
console.log("Fixed encoding pass 5.");
