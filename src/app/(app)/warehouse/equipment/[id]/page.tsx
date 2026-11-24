"use client";

import { useParams } from "next/navigation";
import { EquipmentDetailView } from "@/features/warehouse/components/equipment-detail-view";

export default function WarehouseEquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const equipmentId = params?.id || "";

  return <EquipmentDetailView equipmentId={equipmentId} />;
}
