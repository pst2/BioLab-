import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "./providers";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "BioLab AI — Scientific Intelligence Workspace",
  description: "Next-generation gene search, sequence analysis, and bioinformatics visualization platform.",
};

/* Inline script to apply dark class and language before first paint */
const initScript = `
(function(){
  try {
    var t = localStorage.getItem("biolab:theme");
    var dark = t === "dark" || (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
    var l = localStorage.getItem("biolab:language");
    document.documentElement.lang = (l === "en" || l === "vi") ? l : "vi";
  } catch(e){}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
