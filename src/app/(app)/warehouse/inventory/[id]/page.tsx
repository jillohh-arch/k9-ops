"use client";

import { useParams } from "next/navigation";
import { InventoryDetailView } from "@/features/warehouse/components/inventory-detail-view";

export default function WarehouseInventoryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";

  return <InventoryDetailView sessionId={id} />;
}
