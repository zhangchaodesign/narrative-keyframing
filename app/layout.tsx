import "./globals.css";
import type { Metadata } from "next";
import { geistSans, geistMono, notoSerif, notoSans } from "./fonts";

export const metadata: Metadata = {
  title: "Concept Keyframing",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%2210 0 100 100%22><text y=%22.90em%22 font-size=%2290%22>🪄</text></svg>"
        />
      </head>
      <body
        data-theme="light"
        className={`${geistSans.variable} ${geistMono.variable} ${notoSerif.variable} ${notoSans.variable} antialiased`}
        cz-shortcut-listen="false"
      >
        {children}
      </body>
    </html>
  );
}
