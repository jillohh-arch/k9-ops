"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const steps = [
  { label: "Validando acesso", detail: "Conexão segura estabelecida" },
  { label: "Carregando permissões", detail: "Verificando níveis de autorização" },
  { label: "Sincronizando módulos", detail: "Inicializando componentes" },
];

export default function AppLoading() {
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
        <p>NETLINK [SECURE]</p>
        <p>256-BIT ENCRYPTION</p>
        <p>ACTIVE</p>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center px-6">
        {/* Logo */}
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rotate-45 rounded-xl border border-cyan-400/30" />
          <div className="absolute inset-1 rotate-45 rounded-lg border border-cyan-400/10" />
          <Image
            alt="K9 Ops"
            src="/brand/logo-app.png"
            width={36}
            height={36}
            className="relative z-10"
            priority
          />
        </div>

        {/* Title */}
        <h1 className="mt-6 font-mono text-4xl font-black uppercase tracking-[0.5em] text-white sm:text-5xl">
          K9 OPS
        </h1>

        {/* Subtitle with dashes */}
        <div className="mt-4 flex items-center gap-3">
          <span className="h-px w-8 bg-cyan-400/40" />
          <p className="font-mono text-sm tracking-[0.14em] text-cyan-200/70">
            Preparando painel operacional...
          </p>
          <span className="h-px w-8 bg-cyan-400/40" />
        </div>

        {/* Dog image */}
        <div className="relative mt-8 h-[180px] w-[320px] sm:h-[240px] sm:w-[440px] lg:h-[300px] lg:w-[560px]">
          <Image
            alt=""
            src="/assets/cao_loading.png"
            fill
            className="object-contain opacity-90 drop-shadow-[0_0_40px_rgba(34,211,238,0.3)]"
            priority
          />
          {/* Scan lines overlay */}
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(34,211,238,0.03)_2px,rgba(34,211,238,0.03)_4px)]" />
        </div>

        {/* Progress */}
        <div className="mt-8 w-full max-w-lg">
          <p className="mb-2 text-center font-mono text-2xl font-black text-cyan-300">
            {Math.min(Math.round(progress), 95)}%
          </p>
          <div className="relative h-3 w-full overflow-hidden rounded-full border border-cyan-400/20 bg-cyan-950/40">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 95)}%` }}
            />
            {/* Animated segments overlay */}
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_6px,rgba(4,10,16,0.4)_6px,rgba(4,10,16,0.4)_8px)]" />
          </div>
        </div>

        {/* Steps */}
        <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
          {steps.map((step, index) => {
            const done = index < activeStep;
            const active = index === activeStep;
            return (
              <div
                key={step.label}
                className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cyan-400/30">
                  {done ? (
                    <svg className="h-3 w-3 text-cyan-300" viewBox="0 0 12 12" fill="none">
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
