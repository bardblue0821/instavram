import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthGate from "../components/AuthGate";
import { ToastProvider } from "../components/ui/Toast";
import ConditionalSideNav from "../components/ConditionalSideNav";
import MobileTopNav from "../components/MobileTopNav";
import Providers from "./providers";
import { ColorSchemeScript } from "@mantine/core";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Virtualbum",
  description: "Photo sharing application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        <Providers>
          <ToastProvider>
            <div className="min-h-dvh">
              <MobileTopNav />
              <div className="max-w-5xl w-full mx-auto flex">
                <ConditionalSideNav />
                <div className="flex-1 min-w-0">
                  <AuthGate>
                    <main className="w-full px-4 py-6 pb-20 sm:pb-6">
                      {children}
                    </main>
                  </AuthGate>
                </div>
              </div>
            </div>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
