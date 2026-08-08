import type { Metadata } from "next";
import { PlayerCaseDetail } from "../../../components/player-case-detail";

export const metadata: Metadata = {
  title: "Chi tiết vụ án",
};

export default function CaseDetailPage() {
  return <PlayerCaseDetail />;
}
