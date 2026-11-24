"use client";

import { useParams } from "next/navigation";
import { MaterialDetailView } from "@/features/warehouse/components/material-detail-view";

export default function MaterialDetailPage() {
  const params = useParams<{ id: string }>();
  const materialId = params?.id || "";

  return <MaterialDetailView materialId={materialId} />;
}
