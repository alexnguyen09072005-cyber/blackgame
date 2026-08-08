import type { Metadata } from "next";
import { Leaderboard } from "../../../components/leaderboard";

export const metadata: Metadata = {
  title: "Bảng xếp hạng",
  description: "Bảng xếp hạng trực tiếp của BLACK STORIES.",
};

export default function LeaderboardPage() {
  return <Leaderboard />;
}
