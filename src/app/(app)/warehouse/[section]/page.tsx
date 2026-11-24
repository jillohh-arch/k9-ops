"use client";

import { notFound, useParams } from "next/navigation";
import { WarehouseView, type WarehouseSection } from "@/features/warehouse/components/warehouse-view";

const sections: WarehouseSection[] = [
  "materials",
  "batches",
  "equipment",
  "custody",
  "movements",
];

export default function WarehouseSectionPage() {
  const { section } = useParams<{ section: string }>();
  if (!sections.includes(section as WarehouseSection)) notFound();
  return <WarehouseView section={section as WarehouseSection} />;
}
