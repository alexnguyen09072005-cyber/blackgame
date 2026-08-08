import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BLACK STORIES",
    template: "%s · BLACK STORIES",
  },
  description: "Trò chơi suy luận BLACK STORIES dành cho các đội tham gia.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
  colorScheme: "dark",
};

const DEFAULT_EVENT_TIMEZONE = "Asia/Singapore";

function eventTimezone(): string {
  const configured = process.env.EVENT_TIMEZONE?.trim() || DEFAULT_EVENT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("vi-VN", { timeZone: configured }).format();
    return configured;
  } catch {
    return DEFAULT_EVENT_TIMEZONE;
  }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" data-event-timezone={eventTimezone()}>
      <body>{children}</body>
    </html>
  );
}
