import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { anton } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "KINOVA",
  description: "Stream anime, movies, and TV shows in one place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main>{children}</main>
        <footer
          style={{
            borderTop: "1px solid var(--ring)",
            padding: "32px 24px",
            textAlign: "center",
            background: "#000",
          }}
        >
          <a
            href="/home"
            className={anton.className}
            style={{
              display: "inline-flex",
              fontSize: 20,
              letterSpacing: 1,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: "#fff" }}>KINO</span>
            <span style={{ color: "var(--accent)" }}>VA</span>
          </a>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10 }}>
            Stream anime, movies, and TV shows in one place.
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, opacity: 0.7 }}>
            © {new Date().getFullYear()} KINOVA. All rights reserved.
          </p>
        </footer>
      </body>
    </html>
  );
}
