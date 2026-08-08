# BLACK STORIES — 12 OG

Ứng dụng mobile-first để 12 OG tự đăng nhập, chọn một trong 9 vụ án, hỏi hoặc
gửi đáp án cuối và nhận phán quyết tự động từ OpenAI. Tiến độ, cooldown và bảng
xếp hạng được giữ trong bộ nhớ của tiến trình Next.js.

Không có backend tách riêng: các file trong `app/api` được Vercel chạy dưới dạng
serverless functions. Phần server tối thiểu này là nơi giữ API key, đáp án bí
mật, phiên đăng nhập và state của lượt chơi.

## Luồng chơi

1. OG đăng nhập tại `/dang-nhap` bằng tài khoản đã phát.
2. Chọn vụ án tại `/vu-an`.
3. Gửi từng câu hỏi hoặc đáp án cuối và nhận phán quyết ngay.
4. Server gọi OpenAI đúng một lần cho từng nội dung rồi tự ghi nhận kết quả.
5. Mọi thiết bị đăng nhập cùng một OG dùng chung quota 5 nội dung. Nội dung thứ
   5 kích hoạt cooldown 5 phút cho toàn tài khoản. Chỉ **Câu hỏi** làm tăng số
   câu hỏi trên bảng xếp hạng; cả câu hỏi và đáp án đều chiếm một slot.
6. Xem thứ hạng công khai tại `/bang-xep-hang`.

Mỗi `interactionId` là idempotent: gửi lại cùng nội dung không chiếm thêm slot,
không cộng câu hỏi và không gọi AI lần nữa. Quyền sở hữu OG luôn được lấy từ
cookie phiên đăng nhập, không lấy từ body phía client. Trong một server process,
request đồng thời của cùng OG được kiểm tra/chốt quota trước khi gọi AI.

## Tài khoản 12 OG

Tên đăng nhập là `og01` đến `og12`; mỗi OG có mã mật khẩu 3 ký tự riêng cho sự
kiện ngắn. Bảng mật khẩu để in và phát riêng nằm tại
[`docs/OG_ACCOUNTS.md`](docs/OG_ACCOUNTS.md).

> Repository này **bắt buộc phải để Private**. `game.txt`, dữ liệu server và tài
> liệu tài khoản đều chứa bí mật của trò chơi. Không push chúng lên repository
> công khai và không chia sẻ nguyên file tài khoản cho người chơi.

Runtime chỉ dùng hash `scrypt` của mật khẩu. Cookie phiên được ký, `HttpOnly`,
`SameSite=Lax` và bật `Secure` ở production. Login được giới hạn theo cửa sổ 60
giây trong từng tiến trình trước khi chạy `scrypt` (30 lần/IP, 60 lần toàn hệ
thống).

## Cài đặt local

Yêu cầu Node.js 22 trở lên.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Mở `http://localhost:3000`. Các lệnh kiểm tra:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Biến môi trường

| Biến | Ý nghĩa |
| --- | --- |
| `OPENAI_API_KEY` | API key OpenAI; có thể bổ sung sau khi hoàn thiện giao diện |
| `OPENAI_MODEL` | Model chấm tự động, mặc định `gpt-5.6-terra` |
| `MAX_AI_CALLS` | Giới hạn số call AI phía ứng dụng, mặc định `500` |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên tối thiểu 32 ký tự ở production |
| `EVENT_TIMEZONE` | Múi giờ hiển thị, mặc định `Asia/Singapore` |

Sinh session secret bằng trình quản lý mật khẩu hoặc:

```bash
openssl rand -base64 48
```

Không commit `.env.local`. Khi chưa có `OPENAI_API_KEY`, người chơi vẫn có thể
đăng nhập và xem vụ án, nhưng server sẽ từ chối lượt chơi với thông báo rõ ràng
**trước khi** đặt cooldown hay cộng số câu hỏi.

## Dữ liệu vụ án và cách chấm

`game.txt` là nguồn do Ban tổ chức cung cấp. Chín đề bài công khai và đáp án bí
mật đã được chuyển vào `lib/server/cases.ts`; module này chỉ được import phía
server. API và client chỉ nhận tiêu đề, độ khó và đề bài công khai.

Một lượt dùng một call OpenAI Responses API với Structured Outputs. Prompt chỉ
gửi dữ kiện của vụ án đang chơi, yêu cầu không tiết lộ đáp án và bỏ qua mọi chỉ
dẫn do người chơi chèn vào nội dung. Dữ liệu trả về được kiểm tra lại bằng Zod
trước khi ghi kết quả.

Nguồn hiện có mâu thuẫn ở vụ 2, 3 và 9; ứng dụng giữ nguyên các nhánh thay vì tự
bịa cách hòa giải. Chi tiết nằm tại
[`docs/CASE_REVIEW.md`](docs/CASE_REVIEW.md). Ban tổ chức nên thử riêng ba vụ này
sau khi thêm API key.

## Bảng xếp hạng

Thứ tự được tính theo:

1. số vụ đã giải, giảm dần;
2. thời điểm hoàn thành thành tích, sớm hơn đứng trước;
3. tổng số câu hỏi, ít hơn đứng trước;
4. số OG để kết quả luôn ổn định.

Endpoint công khai chỉ trả dữ liệu bảng xếp hạng và tuyệt đối không trả đáp án,
ghi chú nội bộ hay nội dung chấm AI.

### Giới hạn của bản không database

State chỉ tồn tại trong RAM: restart local server sẽ reset toàn bộ tiến độ. Trên
Vercel, cold start hoặc nhiều function instance có thể khiến state mất hay không
đồng nhất giữa 12 OG. Bản này phù hợp để test nhanh; chạy sự kiện thật trên
Vercel cần bổ sung một kho dữ liệu dùng chung nếu muốn leaderboard bền vững.

## Deploy Vercel

1. Tạo OpenAI project riêng cho sự kiện, đặt spend limit rồi lấy API key.
2. Push source lên một GitHub repository **Private**.
3. Import repository vào Vercel và thêm toàn bộ biến trong `.env.example`.
4. Deploy, đăng nhập cùng một OG trên hai thiết bị, gửi xen kẽ 5 nội dung và xác
   nhận thiết bị gửi sau bị cooldown cùng tài khoản.

Trước giờ chơi, restart tiến trình để xóa dữ liệu thử, kiểm tra đủ 12 tài khoản
và thử các phán quyết Câu hỏi/Đáp án cuối trên cả 9 vụ án. Không coi deploy là
hoàn tất cho đến khi URL production đã được smoke test bằng điện thoại thật.
