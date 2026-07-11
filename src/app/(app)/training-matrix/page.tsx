"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { paths } from "@/lib/routes/paths";

export default function TrainingMatrixRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`${paths.training}?tab=dogs`);
  }, [router]);

  return null;
}
