import type { Metadata } from "next";
import "./globals.css";
import { ConditionalLayout } from '@/components/layout/ConditionalLayout';
import { ToastProvider } from '@/components/ui/toast-provider';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider';
import SessionProvider from '@/components/providers/SessionProvider';
import { TenantProvider } from '@/lib/tenant/tenant-context';
import { AppConfigProvider } from '@/components/providers/AppConfigProvider';
import { getAppSettings } from '@/lib/app-config';
import { Toaster } from 'sonner';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings().catch(() => null);
  const name = settings?.appName || 'dorza.io';
  return {
    title: name,
    description: settings?.tagline || 'WhatsApp Marketing & Automation for Shopify',
  };
}

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
        className="font-sans antialiased"
      >
        <SessionProvider>
          <ReactQueryProvider>
            <TenantProvider>
              <AppConfigProvider>
                <ConditionalLayout>
                  {children}
                </ConditionalLayout>
                <ToastProvider />
                <Toaster position="top-right" richColors />
              </AppConfigProvider>
            </TenantProvider>
          </ReactQueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
