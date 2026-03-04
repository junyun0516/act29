import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Act29 Apps | 레슨실 예약",
  description: "Act29 교회 클래식 악기 레슨실 예약 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
