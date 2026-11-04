import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Digital Health Profile | Jeevan Sahay",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function HealthShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
