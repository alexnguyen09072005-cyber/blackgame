import type { Metadata } from "next";
import { PlayerCaseGrid } from "../../components/player-case-grid";

export const metadata: Metadata = {
  title: "Danh sách vụ án",
};

export default function CasesPage() {
  return <PlayerCaseGrid />;
}

