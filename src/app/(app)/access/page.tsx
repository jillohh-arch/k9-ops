import { Suspense } from "react";

import { AccessProfilesPage } from "@/features/access/components/access-profiles-page";

export default function AccessPage() {
  return (
    <Suspense fallback={null}>
      <AccessProfilesPage />
    </Suspense>
  );
}
