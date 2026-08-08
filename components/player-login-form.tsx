"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, fetchJson, getErrorMessage } from "./client-api";
import { Brand, Button, ErrorNotice, FieldLabel, InfoNotice, Surface, inputClass } from "./ui";

type LoginResponse = {
  data: {
    user: {
      role: "player";
      teamId: string;
      username: string;
      name: string;
    };
  };
};

export function PlayerLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notConfigured, setNotConfigured] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }

    setBusy(true);
    setError("");
    setNotConfigured(false);
    try {
      await fetchJson<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      router.replace("/vu-an");
      router.refresh();
    } catch (loginError) {
      const unavailable =
        loginError instanceof ApiError &&
        (loginError.status === 404 || loginError.status === 501 || loginError.status === 503);
      setNotConfigured(unavailable);
      setError(
        unavailable
          ? "Hệ thống đăng nhập người chơi chưa được cấu hình. Vui lòng báo Ban tổ chức."
          : getErrorMessage(loginError),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-dvh w-full max-w-5xl items-center gap-10 px-4 py-10 lg:grid-cols-[1fr_0.85fr] lg:px-8">
      <div className="hidden lg:block">
        <Brand />
        <p className="mt-12 font-mono text-xs font-bold uppercase tracking-[0.24em] text-amber-300/80">
          Hồ sơ điều tra
        </p>
        <h1 className="mt-4 max-w-xl text-5xl font-black leading-[1.04] tracking-tight text-white">
          Chín câu chuyện.<br /><span className="text-amber-300">Chín sự thật bị che giấu.</span>
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-stone-400">
          Đăng nhập bằng tài khoản đội được Ban tổ chức cấp để mở danh sách vụ án và gửi suy luận.
        </p>
      </div>

      <Surface className="overflow-hidden">
        <div className="border-b border-white/[0.08] px-5 py-5 lg:hidden"><Brand /></div>
        <form onSubmit={submit} className="p-5 sm:p-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/75">Khu vực người chơi</p>
          <h2 className="mt-2 text-3xl font-black text-white">Đăng nhập</h2>
          <p className="mt-3 text-base leading-7 text-stone-400">Dùng tên đăng nhập và mật khẩu riêng của đội bạn.</p>

          <div className="mt-7">
            <FieldLabel htmlFor="player-username">Tên đăng nhập</FieldLabel>
            <input
              id="player-username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={inputClass}
              placeholder="Ví dụ: og01"
              disabled={busy}
              autoFocus
            />
          </div>

          <div className="mt-4">
            <FieldLabel htmlFor="player-password">Mật khẩu</FieldLabel>
            <input
              id="player-password"
              name="password"
              type="password"
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              placeholder="Nhập mật khẩu"
              disabled={busy}
            />
          </div>

          {error ? <div className="mt-4"><ErrorNotice message={error} /></div> : null}
          {notConfigured ? (
            <div className="mt-3"><InfoNotice>Giao diện vẫn sẵn sàng; không có dữ liệu đăng nhập nào được lưu trên thiết bị.</InfoNotice></div>
          ) : null}

          <Button className="mt-6 w-full" type="submit" disabled={busy}>
            {busy ? "Đang xác thực…" : "Mở danh sách vụ án"}
          </Button>
        </form>
      </Surface>
    </div>
  );
}
