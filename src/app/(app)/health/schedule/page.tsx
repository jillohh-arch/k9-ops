"use client";

/**
 * K9 Ops Web — Health Web v1 HW-4 Agenda — RD-I6
 * /health/schedule — Agenda operational list main screen.
 *
 * This page only wires the Health module shell to the Schedule presentation
 * view. It adds NO route, NO data access and NO logic of its own: the view owns
 * the read state ladder, coverage truthfulness and row rendering.
 *
 * Route: /health/schedule
 *
 * Based on:
 * - HEALTH_WEB_INFORMATION_ARCHITECTURE.md §15 (Agenda)
 * - HEALTH_WEB_TARGET_ARCHITECTURE.md §8.3 (Preventive Schedule)
 */
import { HealthModuleShell } from "@/features/health/presentation/components/health-module-shell";
import { ScheduleView } from "@/features/health/schedule/presentation/schedule-view";

export default function HealthSchedulePage() {
  return (
    <HealthModuleShell
      title="Agenda"
      description="Planejamento preventivo e operacional"
      activeNavKey="schedule"
    >
      <ScheduleView />
    </HealthModuleShell>
  );
}
