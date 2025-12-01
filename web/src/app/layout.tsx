import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rallio - Badminton Court Finder",
  description: "Find badminton courts and join queue matches in Zamboanga City",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-white">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white min-h-screen`}
      >
        {children}
        <Toaster 
          position="top-center" 
          richColors 
          expand={true}
          toastOptions={{
            style: {
              padding: '16px',
              gap: '12px',
              minWidth: '320px',
              maxWidth: '500px',
            },
            className: 'text-base',
          }}
        />
      </body>
    </html>
  );
}
