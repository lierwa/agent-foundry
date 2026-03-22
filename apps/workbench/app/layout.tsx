import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Agent Foundry Workbench",
  description: "Operator UI for the general-purpose agent base runtime.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
