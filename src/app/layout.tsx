import type { Metadata, Viewport } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
// Bootstrap 5.3 — imported BEFORE globals.css so Tailwind utilities and the
// custom TrafficLab theme (appended at the end of globals.css) win the cascade.
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import { BootstrapClient } from "@/components/bootstrap-client";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TrafficLab — Traffic Simulation & Analytics Console",
  description:
    "TrafficLab is a premium dashboard for simulating, monitoring and analyzing website traffic. Launch sessions, watch live visit counters, terminal feeds and charts — for testing the sites you own.",
  keywords: ["TrafficLab", "traffic simulation", "load testing", "analytics", "dashboard", "selenium"],
  authors: [{ name: "TrafficLab" }],
  icons: { icon: "/trafficlab-icon.svg" },
  openGraph: {
    title: "TrafficLab — Traffic Simulation & Analytics Console",
    description: "Launch, monitor and analyze traffic simulation sessions in real time.",
    siteName: "TrafficLab",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#050b10",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** Applies the saved theme before first paint to avoid a flash of the wrong theme. */
const themeInit = `try{var t=localStorage.getItem('tl-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-bs-theme',t)}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-bs-theme="dark" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={`${manrope.variable} ${plexMono.variable} antialiased`}>
        <BootstrapClient />
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            theme="dark"
            richColors
            toastOptions={{
              style: {
                background: "rgba(14,28,36,.92)",
                border: "1px solid rgba(120,255,226,.16)",
                color: "#e8f6f3",
                backdropFilter: "blur(14px)",
                fontFamily: "var(--font-manrope), sans-serif",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
