import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Serif for headings and the RE monogram: an editorial, textbook voice next to Inter.
const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Ransom Tutor",
  description:
    "A guided, Socratic tutor for Ransom Everglades courses: Advanced Physics, Applied Data Science, Quantitative Finance & AI, Digital Narrative, and Advanced Machine Learning.",
};

// Runs before first paint so a dark-mode device never flashes the light theme.
// Saved choice (ThemeToggle writes "theme" to localStorage) wins; otherwise follow
// the device, and keep following it live until the student picks one.
const themeScript = `(() => {
  const root = document.documentElement;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const saved = () => { try { return localStorage.getItem("theme"); } catch { return null; } };
  const apply = () => { root.dataset.theme = saved() || (mq.matches ? "dark" : "light"); };
  apply();
  mq.addEventListener("change", () => { if (!saved()) apply(); });
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: data-theme is set by themeScript before React hydrates.
    <html lang="en" className={`${inter.variable} ${newsreader.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
