# Rà soát dữ liệu vụ án

`game.txt` là nguồn do Ban tổ chức cung cấp cho chín vụ án. Dữ liệu đã được chuyển
vào `lib/server/cases.ts` mà không tự sửa nội dung nguồn. Cả chín vụ án được bật
theo yêu cầu; riêng case 2, 3 và 9 có `needsReview: true`, đồng thời ghi rõ mâu
thuẫn vào context riêng cho AI. Với câu hỏi Có/Không phụ thuộc trực tiếp vào các
điểm này, AI được yêu cầu trả **Không quan trọng**; đáp án cuối được so với các dữ kiện lõi
không mâu thuẫn và những phương án được nguồn chấp nhận.

## Case 2 — Tiếng còi định mệnh

- Đề bài gọi phương tiện là “toa tàu ngầm”.
- Đáp án bí mật lại mô tả người đàn ông trở về bằng tàu hỏa và tàu đi vào đường
  hầm.
- `requiredCoreFacts` không buộc loại phương tiện; câu hỏi yêu cầu phân biệt tàu
  ngầm với tàu hỏa phải nhận phán quyết **Không quan trọng**.

## Case 3 — Hộp diêm định mệnh

Đáp án bí mật đưa ra ba cơ chế khác nhau mà không chốt một cơ chế duy nhất:

1. đặt hộp diêm trong túi áo ngực nạn nhân để làm mục tiêu định vị;
2. dùng que diêm để đếm bước và kiểm soát khoảng cách/góc bắn;
3. lắc hộp diêm tạo tiếng động để định hướng đối thủ.

Cả ba được giữ như các phương án nguồn cho phép. Không yêu cầu một đáp án phải
gộp cả ba cơ chế; câu hỏi dùng một cơ chế để phủ định hai cơ chế còn lại phải
nhận phán quyết **Không quan trọng**.

## Case 9 — Chuyến bay ngột ngạt

- Đề bài khẳng định máy bay “không hề gặp trục trặc kỹ thuật”.
- Đáp án bí mật lại nói kim báo nhiên liệu bị hỏng.
- Cả hai phát biểu được giữ nguyên. `requiredCoreFacts` chỉ yêu cầu trực thăng sắp
  hết nhiên liệu và sẽ rơi xuống vùng khí độc, không bắt buộc người chơi hòa giải
  nguyên nhân của chỉ báo nhiên liệu.

## Checklist trước sự kiện

1. Một người trong Ban tổ chức đọc chéo `game.txt` và `lib/server/cases.ts`.
2. Dùng một tài khoản OG để thử ít nhất một câu Có, Không, Không quan trọng,
   một nội dung không phải câu Có/Không để nhận Không thể trả lời, và hai đáp án
   cuối trên màn chơi của từng vụ án.
3. Thử riêng câu hỏi chạm vào các mâu thuẫn của case 2, 3 và 9; xác nhận AI chuyển
   sang “Không quan trọng”, rồi xác nhận hai đáp án cuối đại diện cho các nhánh
   được nguồn chấp nhận đều được xử lý đúng.
4. Giữ repository ở chế độ private vì `lib/server/cases.ts` chứa đáp án bí mật.
