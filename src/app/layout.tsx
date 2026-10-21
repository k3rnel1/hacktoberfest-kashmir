import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { eventConfig } from "@/config/event";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${eventConfig.name} — Registration`,
    template: `%s · ${eventConfig.name}`,
  },
  description: eventConfig.description,
  metadataBase: new URL(eventConfig.appUrl),
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} dark h-full`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#18181b",
              border: "1px solid #26262b",
              color: "#ededed",
            },
          }}
        />
      </body>
    </html>
  );
}
