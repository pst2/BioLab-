import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioLab — Minimal Bioinformatics Workspace",
  description: "Gene lookup, PubMed search and sequence visualization with FastAPI and Next.js",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
