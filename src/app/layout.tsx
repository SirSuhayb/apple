import type { Metadata } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import { CookieConsent } from "@/components/CookieConsent";
import { Providers } from "@/components/Providers";
import { SITE_URL } from "@/lib/config";
import { copy } from "@/lib/copy";
import "./globals.css";

const display = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const siteUrl = SITE_URL.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: copy.meta.title,
  description: copy.meta.description,
  applicationName: copy.brand,
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: copy.brand,
    title: copy.meta.title,
    description: copy.meta.description,
    images: [{ url: "/social_media/biteTaken.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: copy.meta.title,
    description: copy.meta.description,
    images: ["/social_media/biteTaken.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#fbfbfd] text-[#1d1d1f]">
        <Providers>{children}</Providers>
        <CookieConsent />
      </body>
    </html>
  );
}
