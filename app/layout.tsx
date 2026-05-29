import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Socratic AI Tutor",
  description:
    "A guided, Socratic tutor for Advanced Physics: Mechanics and Applied Data Science.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
