import {
  Caveat,
  Geist,
  Geist_Mono,
  Noto_Serif,
  Noto_Sans,
} from "next/font/google";

export const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
  weight: "variable",
});

export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

export const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});
