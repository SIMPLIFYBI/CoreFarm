import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import Header from "./components/Header";
import AuthGuard from "./components/AuthGuard";
import MobileNav from "./components/MobileNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "CoreFarm",
  description: "CoreFarm — plan intervals, log actuals, and track progress across your drilling program.",
};

// Mobile viewport and theme color for safe-area support
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: "no",
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
  <Header />
  <AuthGuard>
    <main className="min-h-screen md:pt-[72px] md:pb-0 pb-[calc(env(safe-area-inset-bottom)+64px)]">
      {children}
    </main>
  </AuthGuard>
  <MobileNav />
  <Toaster position="top-right" />
      </body>
    </html>
  );
}
