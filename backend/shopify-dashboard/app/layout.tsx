import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConditionalLayout } from '@/components/layout/ConditionalLayout';
import { ToastProvider } from '@/components/ui/toast-provider';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider';
import SessionProvider from '@/components/providers/SessionProvider';
import { TenantProvider } from '@/lib/tenant/tenant-context';
import { Toaster } from 'sonner';

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shopify Dashboard",
  description: "WhatsApp Marketing & Automation for Shopify",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <SessionProvider>
          <ReactQueryProvider>
            <TenantProvider>
              <ConditionalLayout>
                {children}
              </ConditionalLayout>
              <ToastProvider />
              <Toaster position="top-right" richColors />
            </TenantProvider>
          </ReactQueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
