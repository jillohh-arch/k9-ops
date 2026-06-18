"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const steps = [
  { label: "Validando acesso", detail: "Conexão segura estabelecida" },
  { label: "Carregando permissões", detail: "Verificando níveis de autorização" },
  { label: "Sincronizando módulos", detail: "Inicializando componentes" },
];

export interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({
  message = "Preparando painel operacional...",
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 95) {
          clearInterval(interval);
          return 95;
        }
        return p + Math.random() * 8 + 2;
      });
    }, 200);

    const stepInterval = setInterval(() => {
      setActiveStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, 1200);

    return () => {
      clearInterval(interval);
      clearInterval(stepInterval);
    };
  }, []);

  return (
    <main className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#040a10]">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/[0.06] blur-[120px]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
      </div>

      {/* Corner HUD elements */}
      <div className="absolute left-6 top-6 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
        <p className="font-bold">K9 OPS SYSTEMS</p>
        <p className="mt-1 text-cyan-400/40">SECURE. CONTROL. DEPLOY.</p>
      </div>
      <div className="absolute right-6 top-6 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-400/40">
        <p>BUILD 2.4.7 <span className="ml-1 inline-block h-2 w-2 rounded-full bg-emerald-400" /></p>
      </div>

      {/* Left HUD */}
      <div className="absolute left-6 top-1/2 hidden -translate-y-1/2 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-400/30 lg:block">
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-3 gap-px">
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-sm bg-cyan-400/40" />
            ))}
          </div>
        </div>
        <p className="mt-2">NODE 12.8.4</p>
        <p>TRACKING...</p>
        <p>STATUS OK</p>
      </div>

      {/* Right HUD */}
      <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 text-right font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-400/30 lg:block">
        <p>LAT -23.5505</p>
        <p>LON -46.6340</p>
        <p className="mt-2">ENCRYPTED</p>
        <p>AES-256</p>
      </div>

      {/* Center content */}
      <div className="relative flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 animate-[spin_8s_linear_infinite] rounded-full border border-cyan-400/20 border-t-cyan-400/60" />
          <div className="absolute inset-2 animate-[spin_6s_linear_infinite_reverse] rounded-full border border-cyan-400/10 border-b-cyan-400/40" />
          <Image
            src="/icons/icon-192x192.png"
            alt="K9 Ops"
            width={72}
            height={72}
            className="relative z-10 drop-shadow-[0_0_12px_rgba(34,211,238,0.4)]"
            priority
          />
        </div>

        {/* Message */}
        <p className="text-center font-mono text-sm font-bold uppercase tracking-[0.25em] text-cyan-100/80">
          {message}
        </p>

        {/* Progress bar */}
        <div className="w-72">
          <div className="h-1 w-full overflow-hidden rounded-full bg-cyan-400/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="mt-2 text-right font-mono text-[10px] tabular-nums text-cyan-400/50">
            {Math.round(Math.min(progress, 100))}%
          </p>
        </div>

        {/* Steps */}
        <div className="mt-2 space-y-3">
          {steps.map((step, index) => {
            const done = index < activeStep;
            const active = index === activeStep;
            return (
              <div key={step.label} className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center">
                  {done ? (
                    <svg className="h-3 w-3 text-emerald-400" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span
                      className={`h-2 w-2 rounded-full ${
                        active ? "animate-pulse bg-cyan-400" : "bg-cyan-400/30"
                      }`}
                    />
                  )}
                </span>
                <div>
                  <p className={`text-sm font-bold ${done || active ? "text-cyan-200" : "text-slate-500"}`}>
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <p className="absolute bottom-6 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-400/25">
        K9 OPS • INTELLIGENCE IN MOTION
      </p>
    </main>
  );
}
