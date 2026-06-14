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

export const toneClasses: Record<TrainingTone, string> = {
  amber: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  blue: "border-blue-300/25 bg-blue-300/10 text-blue-100",
  cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  red: "border-red-300/25 bg-red-300/10 text-red-100",
  slate: "border-slate-300/15 bg-slate-400/10 text-slate-200",
  violet: "border-violet-300/25 bg-violet-300/10 text-violet-100",
};

export const gradientClasses: Record<TrainingTone, string> = {
  amber: "from-amber-300/20 to-amber-300/0",
  blue: "from-blue-300/20 to-blue-300/0",
  cyan: "from-cyan-300/20 to-cyan-300/0",
  emerald: "from-emerald-300/20 to-emerald-300/0",
  red: "from-red-300/20 to-red-300/0",
  slate: "from-slate-300/10 to-slate-300/0",
  violet: "from-violet-300/20 to-violet-300/0",
};

export const toneDotClasses: Record<TrainingTone, string> = {
  amber: "bg-amber-300",
  blue: "bg-blue-300",
  cyan: "bg-cyan-300",
  emerald: "bg-emerald-300",
  red: "bg-red-300",
  slate: "bg-slate-400",
  violet: "bg-violet-300",
};

export const toneTextClasses: Record<TrainingTone, string> = {
  amber: "text-amber-200",
  blue: "text-blue-200",
  cyan: "text-cyan-200",
  emerald: "text-emerald-200",
  red: "text-red-200",
  slate: "text-slate-300",
  violet: "text-violet-200",
};
