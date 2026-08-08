import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const aiSource = readFileSync(
  new URL("../../lib/server/ai.ts", import.meta.url),
  "utf8",
);

describe("chính sách chấm AI", () => {
  it("chấm đáp án cuối theo ý chính thay vì checklist nguyên văn", () => {
    expect(aiSource).toContain(
      "dù câu trả lời ngắn và thiếu chi tiết hỗ trợ",
    );
    expect(aiSource).toContain(
      "không phải checklist câu chữ bắt buộc",
    );
    expect(aiSource).toContain(
      "Chi tiết phụ chưa chính xác nhưng không làm đổi cơ chế chính",
    );
  });

  it("vẫn từ chối lời giải sai cơ chế cốt lõi", () => {
    expect(aiSource).toContain(
      "mâu thuẫn về bản chất với lời giải cốt lõi",
    );
  });

  it("ưu tiên Có/Không cho giả thuyết liên quan và chỉ giữ KQT cho chi tiết thật sự không phân biệt lời giải", () => {
    expect(aiSource).toContain(
      "không chọn KHONG_QUAN_TRONG chỉ vì câu hỏi không xuất hiện nguyên văn",
    );
    expect(aiSource).toContain(
      "Ưu tiên DUNG/SAI cho câu liên quan",
    );
    expect(aiSource).toContain(
      "CHỈ dùng KHONG_QUAN_TRONG khi Có hay Không đều không giúp phân biệt lời giải",
    );
  });
});
