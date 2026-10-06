import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "T_GENIE — Wear your imagination",
  description:
    "Your idea is our command. Turn your imagination into original wearable art with T_GENIE, your personal AI design studio.",
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
