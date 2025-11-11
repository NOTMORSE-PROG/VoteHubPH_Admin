import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoteHubPH Admin",
  description: "Admin dashboard for VoteHubPH",
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
