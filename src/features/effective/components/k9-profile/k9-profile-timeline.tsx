"use client";

import { cn } from "@/lib/utils";

import {
  dateTimeFormatter,
  SectionCard,
  timelineIcons,
  timelineTones,
  type TimelineItem,
} from "./k9-profile-types";

export function K9ProfileTimeline({
  timeline,
}: {
  timeline: TimelineItem[];
}) {
  return (
    <SectionCard title="Linha do tempo recente">
      <div className="relative mt-4 space-y-4 before:absolute before:bottom-3 before:left-[17px] before:top-3 before:w-px before:bg-cyan-300/18">
        {timeline.map((item) => {
          const Icon = timelineIcons[item.category];
          return (
            <div className="relative flex gap-3" key={item.id}>
              <span
                className={cn(
                  "z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                  timelineTones[item.category],
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 border-b border-white/7 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-bold text-slate-200">{item.title}</p>
                  <span className="font-mono text-[10px] text-slate-600">
                    {dateTimeFormatter.format(item.date)}
                  </span>
                </div>
                <p className="mt-1 text-xs capitalize text-slate-500">
                  {item.detail}
                </p>
              </div>
            </div>
          );
        })}
        {!timeline.length ? (
          <p className="pl-12 text-sm text-slate-500">
            Nenhum evento recente localizado.
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
