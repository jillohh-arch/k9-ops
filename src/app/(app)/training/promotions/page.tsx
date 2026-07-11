"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { paths } from "@/lib/routes/paths";

export default function TrainingPromotionsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`${paths.training}?tab=evaluations`);
  }, [router]);

  return null;
}
