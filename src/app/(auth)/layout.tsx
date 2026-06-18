import type { ReactNode } from "react";

// Prevent Next.js from attempting static prerendering of login page.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
