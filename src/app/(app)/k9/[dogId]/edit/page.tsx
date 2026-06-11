"use client";

import { useParams } from "next/navigation";

import { K9AdminForm } from "@/features/effective/components/k9-admin-form";

export default function EditK9Page() {
  const params = useParams<{ dogId: string }>();
  const dogId = decodeURIComponent(params.dogId ?? "");
  return <K9AdminForm dogId={dogId} mode="edit" />;
}
