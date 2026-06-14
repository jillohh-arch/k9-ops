import type { LucideIcon } from "lucide-react";
import type { TrainingTone } from "@/features/training/hooks/use-training-data";

export type ModalityView = {
  icon: LucideIcon;
  label: string;
  tone: TrainingTone;
  value: string;
};

export type CritérionStatus = {
  current: string;
  detail: string;
  icon: LucideIcon;
  label: string;
  missingLabel: string;
  ok: boolean;
  progress: number;
  target: string;
  tone: TrainingTone;
};
