import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/theme";
import { getBrandLogo } from "@/lib/brand";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export function generateMetadata(): Metadata {
  const logo = getBrandLogo();
  const description =
    "A community map of Lagos' riverine settlements — their needs, access and environment.";
  return {
    title: { default: "Blue Lagos Riverine Communities", template: "%s | Blue Lagos" },
    description,
    applicationName: "Blue Lagos",
    ...(logo ? { icons: { icon: logo.src } } : {}),
    openGraph: {
      title: "Blue Lagos Riverine Communities",
      description,
      siteName: "Blue Lagos",
      type: "website",
      ...(logo ? { images: [{ url: logo.src }] } : {}),
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const logo = getBrandLogo();
  return (
    <html lang="en" data-theme="deep" suppressHydrationWarning>
      <head>
        {/* Applies the stored or system-preferred theme before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={plex.variable}>
        <ThemeProvider>
          <AppShell logo={logo}>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
