import type { Metadata } from "next";
import { Inter_Tight, Geist_Mono } from "next/font/google";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
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
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var w=localStorage.getItem('md.width');if(w==='wide')document.documentElement.setAttribute('data-width','wide');var o=localStorage.getItem('md.outline.shown');if(o==='false')document.documentElement.setAttribute('data-outline-hidden','1');var t=localStorage.getItem('md.dev-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <AuthKitProvider>{children}</AuthKitProvider>
        {process.env.NODE_ENV === "development" && <DevThemeSwitcher />}
      </body>
    </html>
  );
}
