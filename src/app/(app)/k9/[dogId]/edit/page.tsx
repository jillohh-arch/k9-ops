"use client";

import { useParams } from "next/navigation";

import { K9EditV1 } from "@/features/effective/components/k9-edit-v1/k9-edit-v1";

export default function EditK9Page() {
  const params = useParams<{ dogId: string }>();
  const dogId = decodeURIComponent(params.dogId ?? "");
  // Edit V1: identity-only experience. The legacy K9AdminForm still serves
  // mode="create" at /k9/new and is intentionally left untouched.
  return <K9EditV1 dogId={dogId} />;
}
