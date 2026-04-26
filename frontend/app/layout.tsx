import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import { AuthProvider } from "@/context/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";
import GoogleMapsProvider from "@/components/map/GoogleMapsProvider";

export const metadata: Metadata = {
  title: "Lemontree Volunteer Hub",
  description: "Connect volunteers with food access resources in your community",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          <GoogleMapsProvider>
            <AuthGuard>
              <AppShell>{children}</AppShell>
            </AuthGuard>
          </GoogleMapsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
