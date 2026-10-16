import type { Metadata } from "next";
import "./globals.css";
import Loading from "./loading";

export const metadata: Metadata = {
  title: "Coursecraft",
  description: "Create responsive learning experiences.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}
  </body></html>;
}
