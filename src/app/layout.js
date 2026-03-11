import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

export const metadata = {
  title: "Bridgecoach",
  description: "Kort en duidelijk bridge-advies",
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}