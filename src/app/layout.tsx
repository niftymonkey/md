import type { Metadata } from "next";
import { Inter_Tight, Geist_Mono } from "next/font/google";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { Toaster } from "sonner";
import { DevThemeSwitcher } from "@/components/dev-theme-switcher";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "md",
  description: "Upload Markdown, get a shareable rendered link.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <AuthKitProvider>{children}</AuthKitProvider>
        <Toaster richColors position="top-center" />
        {process.env.NODE_ENV === "development" && <DevThemeSwitcher />}
      </body>
    </html>
  );
}
