import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script"; // ✅ 追加
import "./globals.css";
import { Header } from "@/components/Header";
import GaPageView from "@/components/analytics/GaPageView"; // ✅ 追加

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://sabacan365.com";
const SITE_NAME = "Sabacan365";
const SITE_DESCRIPTION = "Sabacan365.com English listening quizzes from real videos.";
const OGP_IMAGE = "/toppage.png";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [{ url: OGP_IMAGE, width: 1358, height: 1159, alt: SITE_NAME }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [OGP_IMAGE],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <Header />
        {children}

        {/* ✅ SPA遷移のPV計測 */}
        <GaPageView />

        {/* ✅ GA4本体（確実版） */}
        {gaId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script
              id="ga4-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
// page_view は自前で送るので false
gtag('config', '${gaId}', { send_page_view: false });
                `,
              }}
            />
          </>
        ) : null}
      </body>
    </html>
  );
}
