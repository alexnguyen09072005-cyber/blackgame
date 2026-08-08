import { describe, expect, it } from "vitest";
import { VERDICT_LABELS } from "@/components/game-types";

describe("question verdict labels", () => {
  it("renders yes/no language without changing the other public verdicts", () => {
    expect(VERDICT_LABELS).toEqual({
      DUNG: "Có",
      SAI: "Không",
      KHONG_QUAN_TRONG: "Không quan trọng",
      KHONG_THE_TRA_LOI: "Không thể trả lời",
    });
  });
});
