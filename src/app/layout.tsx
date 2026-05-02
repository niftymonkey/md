import type { Metadata } from "next";
import Script from "next/script";
import { Inter_Tight, Geist_Mono } from "next/font/google";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { withAuth, signOut } from "@workos-inc/authkit-nextjs";
import { isEmailAllowed } from "@/lib/access";
import { DevThemeSwitcher } from "@/components/dev-theme-switcher";
import { CmdPalette } from "@/components/cmd-palette";
import { BrandMark } from "@/components/brand-mark";
import { DropAnywhere } from "@/components/drop-anywhere";
import "./globals.css";

async function signOutAction() {
  "use server";
  await signOut();
}

const PRE_HYDRATION_SCRIPT = `(function(){try{var w=localStorage.getItem('md.width');if(w==='wide')document.documentElement.setAttribute('data-width','wide');var o=localStorage.getItem('md.outline.shown');if(o==='false')document.documentElement.setAttribute('data-outline-hidden','1');var t=localStorage.getItem('md.dev-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-dev-theme',t);}var ua=navigator.userAgent||'';var p=(navigator.userAgentData&&navigator.userAgentData.platform)||'';if(/Mac|iPhone|iPad/.test(ua)||/macOS|iOS/.test(p))document.documentElement.setAttribute('data-platform','mac');}catch(e){}})();`;

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
  const showPalette = user !== null && isEmailAllowed(user.email);

  return (
    <html
      lang="en"
      className={`${interTight.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <Script id="md-pre-hydration" strategy="beforeInteractive">
          {PRE_HYDRATION_SCRIPT}
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
