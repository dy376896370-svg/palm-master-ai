import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "AI手相大师｜五大体系联合解读",
    template: "%s｜AI手相大师",
  },
  description: "上传手掌照片，获得掌纹辅助标注与五大文化体系联合解读。仅供娱乐与自我探索。",
  openGraph: {
    title: "AI手相大师",
    description: "上传手掌照片，获得掌纹辅助标注与五大文化体系联合解读。",
    locale: "zh_CN",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
