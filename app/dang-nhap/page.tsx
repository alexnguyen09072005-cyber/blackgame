import type { Metadata } from "next";
import { PlayerLoginForm } from "../../components/player-login-form";
import { PageShell } from "../../components/ui";

export const metadata: Metadata = {
  title: "Đăng nhập người chơi",
};

export default function PlayerLoginPage() {
  return (
    <PageShell>
      <PlayerLoginForm />
    </PageShell>
  );
}

