import { describe, expect, it } from "vitest";

import {
  ADJUDICATION_SYSTEM_PROMPT,
  DEFAULT_OPENAI_MODEL,
  OPENAI_REASONING_EFFORT,
} from "../../lib/server/ai";

describe("cấu hình AI chấm tự động", () => {
  it("dùng model nhanh với reasoning thấp cho lượt chấm trực tiếp", () => {
    expect(DEFAULT_OPENAI_MODEL).toBe("gpt-5.6-terra");
    expect(OPENAI_REASONING_EFFORT).toBe("low");
  });

  it("chấm đáp án cuối theo ý chính thay vì checklist nguyên văn", () => {
    expect(ADJUDICATION_SYSTEM_PROMPT).toContain(
      "không kiểm tra họ kể lại đáp án đầy đủ đến đâu",
    );
    expect(ADJUDICATION_SYSTEM_PROMPT).toContain(
      "Không bắt buộc nhắc đủ mọi requiredCoreFacts",
    );
    expect(ADJUDICATION_SYSTEM_PROMPT).toContain(
      "không phải checklist bắt buộc phải xuất hiện nguyên văn",
    );
  });

  it("vẫn từ chối lời giải sai cơ chế cốt lõi", () => {
    expect(ADJUDICATION_SYSTEM_PROMPT).toContain(
      "đưa ra nguyên nhân/cơ chế khác bản chất hay mâu thuẫn với lời giải cốt lõi",
    );
    expect(ADJUDICATION_SYSTEM_PROMPT).toContain(
      "Không cho điểm chỉ vì trùng vài từ khóa",
    );
  });

  it("hiểu câu Có/Không theo nghĩa hội thoại và chỉ trả Sai khi thật sự trái canon", () => {
    expect(ADJUDICATION_SYSTEM_PROMPT).toContain(
      "đừng chọn cách hiểu máy móc, cực đoan hơn chỉ để trả SAI",
    );
    expect(ADJUDICATION_SYSTEM_PROMPT).toContain(
      "KHONG_QUAN_TRONG thay vì SAI",
    );
    expect(ADJUDICATION_SYSTEM_PROMPT).toContain(
      "Trái Đất bị diệt vong đúng không?",
    );
  });
});
