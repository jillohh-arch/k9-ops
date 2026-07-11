"use client";

import type { ReactNode } from "react";

import { TrainingK9DataProvider } from "@/features/training-k9/hooks/use-training-k9-data";

export default function TrainingLayout({ children }: { children: ReactNode }) {
  return <TrainingK9DataProvider>{children}</TrainingK9DataProvider>;
}
