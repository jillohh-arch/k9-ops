import { AppShell } from "@/components/layout/app-shell";
import { AuthGate } from "@/features/auth/components/auth-gate";
import { AccessControlProvider } from "@/features/access/providers/access-control-provider";

// All pages in (app) are client-side only (Firebase listeners).
// Prevent Next.js from attempting static prerendering.
export const dynamic = "force-dynamic";

export default function ProtectedAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGate>
      <AccessControlProvider>
        <AppShell>{children}</AppShell>
      </AccessControlProvider>
    </AuthGate>
  );
}
