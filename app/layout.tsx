import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "Palm Master｜AI 掌纹娱乐文化档案",
    template: "%s｜Palm Master",
  },
  description:
    "上传手掌照片，获得照片质量诊断、掌纹知识库解读和可分享的 AI 掌纹娱乐文化档案。",
  openGraph: {
    title: "Palm Master",
    description: "AI Palm Canon entertainment profile. 传统文化娱乐参考，不代表真实命运。",
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
