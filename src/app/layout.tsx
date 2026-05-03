import type { Metadata } from "next";
import Script from "next/script";
import { Inter_Tight, Geist_Mono } from "next/font/google";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { isEmailAllowed } from "@/lib/access";
import { signOutAction } from "@/lib/auth-actions";
import { getUserPreferences } from "@/lib/user-preferences";
import { prefsToHtmlAttrs } from "@/lib/prefs-html-attrs";
import { buildPreHydrationScript } from "@/lib/pre-hydration-script";
import { DevThemeSwitcher } from "@/components/dev-theme-switcher";
import { CmdPalette } from "@/components/cmd-palette";
import { BrandMark } from "@/components/brand-mark";
import { DropAnywhere } from "@/components/drop-anywhere";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await withAuth();
  const isAuthorized = user !== null && isEmailAllowed(user.email);
  const showPalette = isAuthorized;
  const prefs = isAuthorized ? await getUserPreferences(user.id) : null;
  const prefAttrs = prefsToHtmlAttrs(prefs);
  const preHydrationScript = buildPreHydrationScript(isAuthorized);

  return (
    <html
      lang="en"
      className={`${interTight.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
      {...prefAttrs}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <Script id="md-pre-hydration" strategy="beforeInteractive">
          {preHydrationScript}
        </Script>
        <AuthKitProvider>{children}</AuthKitProvider>
        <BrandMark />
        {process.env.NODE_ENV === "development" && <DevThemeSwitcher />}
        {showPalette && <CmdPalette signOutAction={signOutAction} />}
        {showPalette && <DropAnywhere />}
      </body>
    </html>
  );
}
