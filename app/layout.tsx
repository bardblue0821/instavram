import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import HeaderGate from "../components/HeaderGate";
import AuthGate from "../components/AuthGate";
import { ToastProvider } from "../components/ui/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "instaVRam",
  description: "Photo sharing application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
        <ToastProvider>
          <HeaderGate />
          <AuthGate>
            <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
              {children}
            </main>
          </AuthGate>
        </ToastProvider>
      </body>
    </html>
  );
}
