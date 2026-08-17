import type { Metadata } from "next";
import FirebaseAnalytics from "@/components/FirebaseAnalytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kherwal Bazaar - Udhar Recovery System",
  description:
    "Admin dashboard for Kherwal Bazaar Udhar Recovery System.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
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
      <body className="bg-[#f3f4f8] text-slate-800 flex flex-col h-screen overflow-hidden">
        {children}
        <FirebaseAnalytics />
      </body>
    </html>
  );
}
