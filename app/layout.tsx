import type { Metadata, Viewport } from "next";
import AuthGate from "@/components/AuthGate";
import FirebaseAnalytics from "@/components/FirebaseAnalytics";
import ToastProvider from "@/components/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "UDHAAR - Recovery System",
  applicationName: "UDHAAR",
  description:
    "Kherwal Bazaar - Manage sales, customer credit, and recovery tracking with ease.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "UDHAAR",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3a5f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon.png" />
        <meta name="application-name" content="UDHAAR" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="UDHAAR" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#f3f4f8] text-slate-800 flex flex-col h-dvh overflow-hidden">
        <ToastProvider>
          <AuthGate>{children}</AuthGate>
          <FirebaseAnalytics />
        </ToastProvider>
      </body>
    </html>
  );
}
