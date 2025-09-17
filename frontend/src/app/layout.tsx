import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ReactQueryProvider } from "@/lib/react-query-provider";
import { config } from "@/lib/config";
import { Toaster } from 'react-hot-toast';
import { Suspense } from 'react';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Pump Roulette",
  description: "Random pump.fun stream pairing with real-time chat",
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
      { url: '/favicon.ico', type: 'image/x-icon' }
    ],
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased dark`} suppressHydrationWarning>
        <ReactQueryProvider>
          <Suspense fallback={
            <div className="h-screen bg-[#15161B] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                <p className="text-gray-400">Loading...</p>
              </div>
            </div>
          }>
            {children}
          </Suspense>
          <Toaster position="top-right" />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
