import type { Metadata } from "next";
import { Nunito_Sans, Quicksand } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Quicksand: a rounded, friendly display face for headings — warm rather
// than clinical, but still legible at small sizes for grandparents and kids
// alike.
const quicksand = Quicksand({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Nunito Sans: rounded terminals like Quicksand but built for body copy —
// pairs with it without the page feeling like two unrelated typefaces.
const nunitoSans = Nunito_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GenFolio",
  description: "See how your family connects, and the health patterns you share.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${quicksand.variable} ${nunitoSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
