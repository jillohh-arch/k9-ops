import {
  Crosshair,
  Dog,
  ShieldCheck,
  Target,
} from "lucide-react";

import type { TrainingTone } from "@/features/training/hooks/use-training-data";
import type { ModalityView } from "./training-matrix-types";

export const modalityViews: ModalityView[] = [
  {
    icon: Target,
    label: "Busca & Captura",
    tone: "cyan",
    value: "busca_captura",
  },
  {
    icon: Crosshair,
    label: "Detecção",
    tone: "emerald",
    value: "deteccao",
  },
  {
    icon: ShieldCheck,
    label: "Guarda & Proteção",
    tone: "amber",
    value: "guarda_protecao",
  },
  {
    icon: Dog,
    label: "Obediência",
    tone: "violet",
    value: "obediencia",
  },
];

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
  amber: "from-amber-300/80 to-amber-400/60",
  blue: "from-blue-300/80 to-blue-400/60",
  cyan: "from-cyan-300/80 to-cyan-400/60",
  emerald: "from-emerald-300/80 to-emerald-400/60",
  red: "from-red-300/80 to-red-400/60",
  slate: "from-slate-400/60 to-slate-500/40",
  violet: "from-violet-300/80 to-violet-400/60",
};
