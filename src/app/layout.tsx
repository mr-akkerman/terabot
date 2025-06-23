import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";
import { MainLayout } from "@/components/layout/MainLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Terabot",
  description: "⚡ Мощный инструмент для массовых Telegram рассылок. Next.JS + IndexedDB + Bot API. Все данные хранятся локально, рассылки идут из браузера.",
  keywords: ["telegram", "рассылка", "bot", "массовые рассылки", "telegram bot", "broadcast", "messaging"],
  authors: [{ name: "Terabot Team" }],
  creator: "Terabot",
  publisher: "Terabot",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    title: "Terabot - Мощный инструмент для Telegram рассылок",
    description: "⚡ Мощный инструмент для массовых Telegram рассылок. Next.JS + IndexedDB + Bot API. Все данные хранятся локально, рассылки идут из браузера.",
    siteName: "Terabot",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terabot - Мощный инструмент для Telegram рассылок",
    description: "⚡ Мощный инструмент для массовых Telegram рассылок. Next.JS + IndexedDB + Bot API. Все данные хранятся локально, рассылки идут из браузера.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <MainLayout>{children}</MainLayout>
        </Providers>
      </body>
    </html>
  );
}
