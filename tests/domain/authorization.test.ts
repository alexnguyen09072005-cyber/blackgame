import { describe, expect, it } from "vitest";

import { GAME_MASTERS, TEAMS } from "../../lib/config/teams";
import {
  canAccessTeam,
  getAssignedTeamIds,
  gmOwnsTeam,
} from "../../lib/domain/authorization";

describe("phân quyền Quản trò", () => {
  it("cấu hình đúng 12 OG, mỗi GM phụ trách đúng 4 OG", () => {
    expect(TEAMS).toHaveLength(12);
    expect(GAME_MASTERS).toHaveLength(3);

    for (const gameMaster of GAME_MASTERS) {
      expect(getAssignedTeamIds(gameMaster.id)).toHaveLength(4);
    }
  });

  it("GM chỉ truy cập các OG được phân công, Admin truy cập tất cả", () => {
    expect(gmOwnsTeam("gm-1", "og-01")).toBe(true);
    expect(gmOwnsTeam("gm-1", "og-04")).toBe(true);
    expect(gmOwnsTeam("gm-1", "og-05")).toBe(false);
    expect(gmOwnsTeam("gm-2", "og-08")).toBe(true);
    expect(gmOwnsTeam("gm-2", "og-09")).toBe(false);
    expect(gmOwnsTeam("gm-3", "og-12")).toBe(true);
    expect(gmOwnsTeam("gm-khong-ton-tai", "og-01")).toBe(false);

    expect(canAccessTeam({ role: "GM", gmId: "gm-1" }, "og-05")).toBe(
      false,
    );
    expect(canAccessTeam({ role: "ADMIN" }, "og-05")).toBe(true);
  });
});
