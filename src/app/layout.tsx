import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from '@/contexts/LanguageContext';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SechaLog Client Portal",
  description: "Accédez à vos données de pesée SechaLog",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
