import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const filePath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "App.tsx");
let content = readFileSync(filePath, "utf8");

const replacements = [
  // Đ-corruption in messages
  ["Có thĐ chia quỹ", "Có thể chia quỹ"],
  ["Chia lĐi theo từ lĐ %", "Chia lại theo tỷ lệ %"],
  ["SĐ VND mua USDT Đang lĐn hon vốn BTC chưa ĐĐi.", "Số VND mua USDT đang lớn hơn vốn BTC chưa đổi."],
  ["SĐ VND mua USDT Đang lĐn hon vốn crypto chưa ĐĐi.", "Số VND mua USDT đang lớn hơn vốn crypto chưa đổi."],
  ["Nhập ?? số kĐ, BTC tĐch lấy, giĐ gần nhất vĐ giĐ trung bĐnh.", "Nhập đủ số kỳ, BTC tích lũy, giá gần nhất và giá trung bình."],
  ["Số dư USDT khĐng ?? ĐĐ import DCA nĐy. CĐn khoảng", "Số dư USDT không đủ để import DCA này. Cần khoảng"],
  ["hiĐn cổ", "hiện có"],
  ["Dữ liệu giĐ khĐng hợp lệ Đã tạo lịch sử DCA.", "Dữ liệu giá không hợp lệ để tạo lịch sử DCA."],
  ["Nhập BTC tĐch lấy vĐ giĐ trung bĐnh hợp lệ.", "Nhập BTC tích lũy và giá trung bình hợp lệ."],
  ["BTC chờ được ĐĐi sang USDT trong quỹ BTC.", "BTC chỉ được đổi sang USDT trong quỹ BTC."],
  ["BTC chờ được ĐĐi sang USDT trong quỹ Crypto.", "BTC chỉ được đổi sang USDT trong quỹ Crypto."],
  ["SOL chờ được ĐĐi sang USDT trong quỹ Crypto.", "SOL chỉ được đổi sang USDT trong quỹ Crypto."],
  ["TĐ kế hoạch phân bổ", "Từ kế hoạch phân bổ"],
  ["TĐ kĐ hoĐch phân bĐ", "Từ kế hoạch phân bổ"],
  ["Chọn mã cổ phiếu Đang giĐ ?? app từ tính theo số cổ hiĐn có.", "Chọn mã cổ phiếu đang giữ để app tự tính theo số cổ hiện có."],
  ["ChĐ áp ĐĐng", "Chưa áp dụng"],
  ["Chọn mã cổ phiếu Đang giĐ và số cổ ?? quyền hợp lệ.", "Chọn mã cổ phiếu đang giữ và số cổ đủ quyền hợp lệ."],
  ["Nhập % cổ tức tiền mặt hoĐc tiền/cp.", "Nhập % cổ tức tiền mặt hoặc tiền/cp."],
  ["Có thĐ nhập tay mã lĐi.", "Có thể nhập tay mã lại."],
  ["Đã tất toán trĐĐc hĐn.", "Đã tất toán trước hạn."],
  ["Xóa số ${item.code}Đ Thao tác này số xóa số khĐi lịch sử và bĐng tang truĐng tài sĐn.", "Xóa sổ ${item.code}? Thao tác này sẽ xóa sổ khỏi lịch sử và bằng tăng trưởng tài sản."],
  ["Tạo mới từ số trĐĐc.", "Tạo mới từ sổ trước."],
  ["Ngày tất toán trĐĐc hĐn", "Ngày tất toán trước hạn"],
  ["Đang gĐi", "Đang gửi"],
  ["Tất toán trĐĐc hĐn", "Tất toán trước hạn"],
  ["Nhập BTC tĐch lấy vĐ giĐ trung bĐnh hợp lệ.", "Nhập BTC tích lũy và giá trung bình hợp lệ."],
  ["Quỹ ĐĐu tu", "Quỹ đầu tư"],
  ["TiĐn chờ tạo sĐ", "Tiền chờ tạo sổ"],
  ["Restore backup số thay toàn bĐ dữ liệu hiện tại. App sẽ từ lưu mặt bĐn backup truĐc khi restore. TiĐp tĐc", "Restore backup sẽ thay toàn bộ dữ liệu hiện tại. App sẽ tự lưu bản backup trước khi restore. Tiếp tục"],
  ["Chọn mã Đang giĐ, số luĐng và giá hợp lệ.", "Chọn mã đang giữ, số lượng và giá hợp lệ."],
  ["Quyền mua cĐn", "Quyền mua cần"],
  ["vuĐt tiền được CK", "vượt tiền mặt CK"],
  ["Đang tĐi lĐi BTC ledger...", "Đang tải lại BTC ledger..."],
  ["Đã tĐi lĐi BTC ledger.", "Đã tải lại BTC ledger."],
  ["Không tĐi lĐi được BTC ledger.", "Không tải lại được BTC ledger."],
  ["Đã bĐ qua vấn đề dữ liệu.", "Đã bỏ qua vấn đề dữ liệu."],
  ["Đã dánh ĐĐu vấn đề dữ liệu dã xử lý.", "Đã đánh dấu vấn đề dữ liệu đã xử lý."],
  ["Đã hĐy kế hoạch phân bổ tiền.", "Đã hủy kế hoạch phân bổ tiền."],
  ["Đã hĐy kĐ hoĐch phân bĐ tiền.", "Đã hủy kế hoạch phân bổ tiền."],
  ["PIN này dã có tài khoĐn. Hãy chọn PIN khác hoĐc ĐĐi PIN.", "PIN này đã có tài khoản. Hãy chọn PIN khác hoặc đổi PIN."],
  ["Đã tạo tài khoĐn mới. BĐn có thĐ quay lĐi app và ĐĐng nhập bĐng PIN này.", "Đã tạo tài khoản mới. Bạn có thể quay lại app và đăng nhập bằng PIN này."],
  ["Đã ĐĐi PIN. TĐ giĐ hãy ĐĐng nhập bĐng PIN mới.", "Đã đổi PIN. Từ giờ hãy đăng nhập bằng PIN mới."],
  ["Đang mĐ tài khoĐn...", "Đang mở tài khoản..."],
  ["Đã mĐ dữ liệu cloud.", "Đã mở dữ liệu cloud."],
  ["Không mĐ được dữ liệu cloud.", "Không mở được dữ liệu cloud."],
  ["Không mĐ được tài khoĐn. Kiểm tra PIN, Supabase hoĐc mạng.", "Không mở được tài khoản. Kiểm tra PIN, Supabase hoặc mạng."],
  ["Đang ĐĐi PIN...", "Đang đổi PIN..."],
  ["Đã ĐĐi PIN trên thiết bị này.", "Đã đổi PIN trên thiết bị này."],
  ["Đã ĐĐi PIN và đồng bộ cloud.", "Đã đổi PIN và đồng bộ cloud."],
  ["Không ĐĐi được PIN cloud. Vào /admin được ĐĐi PIN lĐi.", "Không đổi được PIN cloud. Vào /admin để đổi PIN lại."],
  ["Hãy mĐ app bĐng mã PIN truĐc.", "Hãy mở app bằng mã PIN trước."],
  ["Đã lưu local, nhung chưa đồng bộ được BTC cloud.", "Đã lưu local, nhưng chưa đồng bộ được BTC cloud."],

  // ?-mojibake in UI
  ["Tháng này đã xác nh?n chia quỹ.", "Tháng này đã xác nhận chia quỹ."],
  ["T?n su?t", "Tần suất"],
  ["S? k? dã kích ho?t", "Số kỳ đã kích hoạt"],
  ["L?nh DCA", "Lệnh DCA"],
  ["Ch?a có k? ho?ch DCA.", "Chưa có kế hoạch DCA."],
  ["Ch?a có k? ho?ch DCA ?ang ch?y.", "Chưa có kế hoạch DCA đang chạy."],
  [" S?a", " Sửa"],
  [">S?a<", ">Sửa<"],
  ["S? l??ng tích luy", "Số lượng tích lũy"],
  ["S? BTC", "Số BTC"],
  ["S? SOL", "Số SOL"],
  ["S? USDT", "Số USDT"],
  ["S? BTC nh?n", "Số BTC nhận"],
  ["N?i nh?n", "Nơi nhận"],
  ["L?u giao d?ch", "Lưu giao dịch"],
  ["giao d?ch", "giao dịch"],
  ["Ch?n mã", "Chọn mã"],
  ["Ch?n m?c tích luy", "Chọn mục tích luy"],
  ["T? l? t?", "Tỷ lệ từ"],
  ["T? l? ??n", "Tỷ lệ đến"],
  ["C? t?c %", "Cổ tức %"],
  ["C? t?c %<", "Cổ tức %<"],
  ["Ti?n/cp", "Tiền/cp"],
  ["Thu? %", "Thuế %"],
  ["K?t qu? d? ki?n", "Kết quả dự kiến"],
  ["TĐ tính", "Tự tính"],
  ["Xác nh?n", "Xác nhận"],
  ["Ch?ng khoán", "Chứng khoán"],
  ["T?t toán tr??c h?n", "Tất toán trước hạn"],
  ["Cài ???ct", "Cài đặt"],
  ["Xem t?t c?", "Xem tất cả"],
  [">T?ng<", ">Tổng<"],
  ["th? hoàn tác", "thể hoàn tác"],
  [" l?nh", " lệnh"],
  ["M?c thu", "Mục thu"],
  ["M?c chi", "Mục chi"],
  ["USDT m?i k?", "USDT mỗi kỳ"],
  ["Mã ?ang gi?", "Mã đang giữ"],
  ["Mã c? phi?u", "Mã cổ phiếu"],
  ["<label>Qu?<select", "<label>Quỹ<select"],
  ["Tài sản ngu?n", "Tài sản nguồn"],
  ["Giá quy?n mua", "Giá quyền mua"],
  ["Số cổ nh?n", "Số cổ nhận"],
  ["Ch?a áp ??ng c? t?c/quy?n mua nào.", "Chưa áp dụng cổ tức/quyền mua nào."],
  ["?ang ch?y", "đang chạy"],
  ["L?u<", "Lưu<"],
  [" L?u", " Lưu"],
  ["L?u BTC", "Lưu BTC"],
  ["L?u USDT", "Lưu USDT"],
  ["L?u kế hoạch", "Lưu kế hoạch"],
  ["L?u k? ho?ch", "Lưu kế hoạch"],
  ["L?u</button>", "Lưu</button>"],
  ["L?ch sử giao d?ch DCA", "Lịch sử giao dịch DCA"],
  ["Ch?a có giao d?ch Crypto.", "Chưa có giao dịch Crypto."],
  ["Ch?a có thao tác nào có th? hoàn tác trong phiên này.", "Chưa có thao tác nào có thể hoàn tác trong phiên này."],
];

for (const [from, to] of replacements) {
  content = content.split(from).join(to);
}

writeFileSync(filePath, content, "utf8");

let remaining = 0;
for (const match of content.matchAll(/(?:>|"|'|`)([^"'`>]{2,80})(?:<|"|'|`)/g)) {
  const value = match[1];
  if (/[Đ][a-zà-ỹ]|[a-zà-ỹ][Đ]|\?[a-zà-ỹà-ỹ]|[a-zà-ỹà-ỹ]\?|\?\?/.test(value) && !value.includes("?.") && !value.includes("?ids=")) {
    remaining += 1;
  }
}
console.log(`Fixed encoding pass 3. Approx remaining UI fragments: ${remaining}`);
