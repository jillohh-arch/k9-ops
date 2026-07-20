"use client";

import { useSearchParams } from "next/navigation";
import { NutritionPlanManagement } from "@/features/health/nutrition/components/nutrition-plan-management";

export default function NutritionPlanPage() {
  const searchParams = useSearchParams();
  const dogIdFromQuery = searchParams.get("dogId") ?? undefined;

  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-6 px-4 sm:px-6 lg:px-8">
      <NutritionPlanManagement initialDogId={dogIdFromQuery} />
    </div>
  );
}
