import type { Metadata, Viewport } from "next";
import { Caveat, Special_Elite, Lora } from "next/font/google";
import "./globals.css";

const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"] });
const specialElite = Special_Elite({ variable: "--font-special-elite", subsets: ["latin"], weight: "400" });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Obis Journal",
  description: "A private scrapbook journal",
  applicationName: "Obis Journal",
  appleWebApp: { capable: true, title: "Obis Journal", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f3e9d2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${caveat.variable} ${specialElite.variable} ${lora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
