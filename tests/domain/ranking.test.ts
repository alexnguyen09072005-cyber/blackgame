import { describe, expect, it } from "vitest";

import {
  compareLeaderboardEntries,
  getAchievementTime,
  sortLeaderboard,
} from "../../lib/domain/ranking";
import type { LeaderboardEntry } from "../../lib/domain/types";

const entry = (
  teamNumber: number,
  solvedCount: number,
  achievementTime: number,
  questionCount: number,
): LeaderboardEntry => ({
  teamId: `og-${String(teamNumber).padStart(2, "0")}`,
  teamNumber,
  teamName: `OG ${String(teamNumber).padStart(2, "0")}`,
  solvedCount,
  achievementTime,
  questionCount,
});

describe("xếp hạng", () => {
  it("ưu tiên số vụ, thời điểm đạt thành tích, số câu rồi số OG", () => {
    const ranked = sortLeaderboard([
      entry(8, 2, 2_000, 10),
      entry(4, 2, 1_000, 12),
      entry(3, 3, 3_000, 99),
      entry(2, 2, 1_000, 10),
      entry(1, 2, 1_000, 10),
    ]);

    expect(ranked.map((team) => team.teamNumber)).toEqual([3, 1, 2, 4, 8]);
  });

  it("dùng solve muộn nhất làm achievementTime và Infinity nếu chưa solve", () => {
    expect(
      getAchievementTime([
        { caseId: "case-01", solvedAt: 500, interactionId: "i-1" },
        { caseId: "case-02", solvedAt: 900, interactionId: "i-2" },
      ]),
    ).toBe(900);
    expect(getAchievementTime([])).toBe(Number.POSITIVE_INFINITY);
  });

  it("comparator trả về hòa khi mọi khóa xếp hạng giống nhau", () => {
    const left = entry(1, 0, Number.POSITIVE_INFINITY, 0);
    expect(compareLeaderboardEntries(left, { ...left })).toBe(0);
  });
});
