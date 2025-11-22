import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Microbots",
  description: "AI-powered swarm assembly system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
