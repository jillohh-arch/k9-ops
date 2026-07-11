"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { paths } from "@/lib/routes/paths";

export default function TrainingCurriculumsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(paths.trainingMatrices);
  }, [router]);

  return null;
}
