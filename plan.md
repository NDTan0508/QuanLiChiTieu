1. Nền Tảng
Bạn muốn app chạy kiểu nào: web local trên máy tính, hay deploy online để mở trên điện thoại/laptop đều được?
-> tôi muốn app chạy trên điện thoại/laptop đều được, chủ yêu sẽ dùng trên điện thoại
Dữ liệu lưu ở đâu: SQLite local trong máy, hay database online?
-->có thể lưu ở database online như supabase
Có cần dùng được trên điện thoại tốt như app mobile không?
-->có thể dùng trên điện thoại tốt như app mobile
Có cần backup/export Excel sau này không?
-->có thể backup/export Excel sau này
2. Cách Nhập Tiền
--> nhập thủ công từ bàn phím
5. Bạn muốn nhập 9000 là hiểu 9.000.000đ, hay nhập đầy đủ 9000000?
--> nhập 9.000.000đ
6. App hiển thị tiền theo dạng 9.000.000đ hay 9M?
-->9.000.000đ
7. Ngày tháng dùng định dạng nào: 01/08/2026 hay 2026-08-01?
-->01/08/2026
3. Dashboard
8. Dashboard mặc định mở tháng hiện tại hay tháng gần nhất có dữ liệu?
-->mở tháng hiện tại
9. Bạn muốn có nút chuyển tháng trước/sau không?
-->có nút chuyển tháng trước/sau
10. Hai pie chart thu nhập/chi tiêu hiển thị theo danh mục, đúng không?
-->hai pie chart thu nhập/chi tiêu hiển thị theo danh mục
11. Tổng tiết kiệm tháng tính bằng công thức nào chính xác?
Ví dụ:
tiết kiệm = thu nhập - chi tiêu
hay:
tiết kiệm = thu nhập - chi tiêu + tiền dư cuối tháng từ các mục đầu/cuối
-->tiết kiệm = thu nhập - chi tiêu + tiền dư cuối tháng từ các mục đầu/cuối
4. Thu Nhập
12. Thu nhập cố định như PT Valley mỗi tháng app tự tạo dòng 0đ để bạn xác nhận, đúng không?
-->không, tôi sẽ tự nhập số tiền
13. Một tháng PT Valley có thể nhận nhiều lần không, hay chỉ một lần?
-->1 lần
14. Thu nhập phát sinh như Fishing có cần lưu từng lần nhận với ngày + ghi chú không?
-->có
15. Có cần trạng thái “chưa nhận / đã nhận” không?
-->không
5. Chi Tiêu
16. Danh mục chi tiêu kiểu đầu/cuối hiện tại gồm những mục nào?
-->đổi ăn uống và phát sinh thành chi tiêu và phát sinh, chi tiêu sẽ cố định tiền mỗi tháng còn phát sinh thì tôi có tạo thêm những khoản phát sinh trong tháng và cộng vào khoản chi phí này + note, chỉ 2 mục này là chi tiêu kiểu đầu/cuối
17. Danh mục chi cố định hàng tháng gồm những mục nào?
--> mẹ
du lịch
học phí, tôi có thể tự do tạo hoặc thay đổi chi phí cố định và đầu/cuối
18. Với khoản kiểu đầu/cuối, công thức có phải là:
đã chi = tiền đầu tháng - tiền cuối tháng
tiền dư = tiền cuối tháng
Với khoản cố định như mẹ, du lịch, học phí: khi tick đã chuyển, app mới tính vào chi tiêu, hay luôn tính ngay từ đầu tháng? --> tick mới tính
Có cần thêm khoản chi phát sinh một lần không, ví dụ sửa xe, mua đồ, đi chơi đột xuất? --> có 
6. Checklist
21. Checklist mỗi tháng gồm những mục cố định nào? --. những khoản chi phí cố định
22. Checklist có tự tạo mỗi tháng không? --> không
23. Tick checklist có ảnh hưởng đến tính toán tiền không, hay chỉ để nhắc việc? --> khi tick đã chuyển, app mới tính vào chi tiêu
7. Chia Tiết Kiệm
24. Mặc định tỷ lệ là BTC 20%, CK 20%, Quỹ tiết kiệm 40%, Dự phòng 20%, đúng không? --> không, có thể thay đổi tỷ lệ cố định
25. Tỷ lệ mỗi tháng bắt buộc tổng bằng 100% chứ? --> đúng
26. Khi thay đổi tỷ lệ, app chỉ tính gợi ý hay tự cộng tiền vào từng quỹ?   --> chỉ gợi ý
27. Bạn muốn có nút Xác nhận chia quỹ để khóa số tiền tháng đó không? --> có nút xác nhận chia quỹ, mỗi cuối tháng bấm nút xác nhận tổng kết chia quỹ tích lũy thì mới bắt đầu tính vào các quỹ. riêng quỹ tiết kiệm và quỹ dự phòng có một thông báo để tôi nhập: số tiền, ngày gửi (ngày tôi nhập), kỳ hạn, lãi suất.
28. Nếu sau khi đã chia quỹ mà bạn nhập thêm thu nhập/chi tiêu, app nên tự cập nhật số chia, hay báo “cần chia lại”? --> tự cập nhật
8. BTC Và CK
29. BTC và CK chỉ là quỹ VND, không cần giá coin/chứng khoán, đúng không?--> đúng
30. Khi rút BTC/CK, tiền rút chuyển đi đâu: tiền mặt, chi tiêu, hay chỉ ghi lịch sử? --> chỉ ghi lịch sử
31. Có cần ghi lý do rút và ngày rút không? --> có
9. Quỹ Tiết Kiệm MBB / Dự Phòng
32. Hai quỹ này đều dùng mô hình sổ tiết kiệm riêng, đúng không? --. đúng
33. Mỗi lần gửi cần nhập: số tiền, ngày gửi, kỳ hạn, lãi suất, đúng không? --> đúng
34. Lãi tính theo công thức đơn:
lãi = gốc x lãi suất năm x số tháng / 12
Có cần hỗ trợ kỳ hạn theo ngày không, hay chỉ theo tháng? --> chỉ theo tháng
Khi đáo hạn, 3 lựa chọn là: rút toàn bộ, quay vòng gốc, quay vòng gốc + lãi, đúng không? --> đúng
Khi quay vòng, app luôn tạo sổ mới và liên kết với sổ cũ, đúng không? --> đúng
Tất toán trước hạn mặc định lãi = 0, đúng không? --> đúng
Mốc highlight sắp đáo hạn là còn 30 ngày màu vàng, còn 7 ngày màu đỏ, ổn không? --> ổn
10. SOL
40. SOL cần lấy giá hiện tại từ CoinGecko, đúng không? --> đúng
41. Nếu mất mạng hoặc API lỗi, app hiển thị giá cuối cùng đã lưu hay báo không cập nhật được? --> hiển thị giá cuối cùng đã lưu
42. SOL chỉ tính bằng USDT, hay cần quy đổi sang VND? --> usdt
43. Có cần tính tỷ giá USD/VND không? --> có, tính tỉ giá hiện tại
44. Có cần tính phí mua bán SOL không? --> không
11. Báo Cáo
45. Báo cáo nào quan trọng nhất ở bản đầu tiên: theo tháng, theo năm, theo quỹ, hay tổng tài sản? --> tổng tài sản
46. Tổng tài sản gồm những phần nào?
BTC + CK + SOL + Quỹ tiết kiệm + Quỹ dự phòng + tiền mặt? --> không cần tiền mặt
Có cần biểu đồ tăng trưởng tài sản theo thời gian ngay bản đầu tiên không? --> có
12. Dữ Liệu Cũ
48. Bạn có muốn import dữ liệu từ file Excel hiện tại vào app không? không cần, tôi sẽ tự nhập số tiền
49. Nếu import, có cần giữ đúng các tháng 06/2026, 07/2026, 08/2026 trong file không?
50. Các dòng cũ chưa rõ như rút, note, dư tháng trước bạn muốn mình chuyển vào app theo logic nào?
13. Giao Diện
51. Bạn thích giao diện sáng, tối, hay có cả dark mode? --> tối
52. Phong cách bạn muốn: tối giản tài chính, dashboard hiện đại, hay giống app ngân hàng? --> tối giản tài chính
53. Màu chủ đạo bạn thích là gì? --> cam đen, nhìn công nghệ, hiện đại
54. Menu app nên gồm các mục nào?