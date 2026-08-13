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
      <body className="bg-[#f3f4f8] text-slate-800 flex flex-col h-screen overflow-hidden">
        {children}
        <FirebaseAnalytics />
      </body>
    </html>
  );
}
