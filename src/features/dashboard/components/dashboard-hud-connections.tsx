"use client";

/**
 * Decorative SVG connections drawn between the HUD cards and the central
 * ring. Renders nothing on viewports below the `lg` breakpoint.
 *
 * Card positions are read from a `Map<string, HTMLElement>` stored in
 * local state (no prop mutation, no `window` registry). The HUD
 * composition passes a `registerSource` callback to each card, which
 * forwards the card element through that callback so the connection
 * layer can recompute paths on layout changes.
 *
 * Effects are fully torn down on unmount: the `ResizeObserver` is
 * disconnected and any pending `requestAnimationFrame` is cancelled.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { connectionStrokeClass, gradientStop } from "./dashboard-utils";
import type { DashboardTone } from "./dashboard-utils";

export interface HudConnection {
  id: string;
  tone: DashboardTone;
}

export interface HudCoreNode {
  node: HTMLElement | null;
}

export interface HudConnectionsProps {
  connections: HudConnection[];
  /** Current position of the core element (set by the HUD composition). */
  coreNode: HudCoreNode["node"];
  /** Lookup of card nodes registered via `registerSource`. */
  cardNodes: Map<string, HTMLElement>;
  /** Optional class applied to the outer SVG container. */
  className?: string;
}

interface ResolvedConnection {
  id: string;
  tone: DashboardTone;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const NODE_RADIUS = 3;
const CORNER_RADIUS = 14;
const STROKE_WIDTH = 1;

export function DashboardHudConnections({
  connections,
  coreNode,
  cardNodes,
  className,
}: HudConnectionsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [resolved, setResolved] = useState<ResolvedConnection[]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;
    let observer: ResizeObserver | null = null;

    const scheduleResolve = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const bounds = container.getBoundingClientRect();
        if (!coreNode) {
          setResolved([]);
          return;
        }
        const coreRect = coreNode.getBoundingClientRect();
        const coreCx = coreRect.left + coreRect.width / 2 - bounds.left;
        const coreCy = coreRect.top + coreRect.height / 2 - bounds.top;
        const coreRadius = coreRect.width / 2;

        const next: ResolvedConnection[] = [];
        for (const connection of connections) {
          const node = cardNodes.get(connection.id);
          if (!node) continue;
          const rect = node.getBoundingClientRect();
          const cardCx = rect.left + rect.width / 2 - bounds.left;
          const cardCy = rect.top + rect.height / 2 - bounds.top;

          const cardRadius = Math.max(rect.width, rect.height) / 2;
          const dx = coreCx - cardCx;
          const dy = coreCy - cardCy;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const x1 = cardCx + (dx / dist) * cardRadius;
          const y1 = cardCy + (dy / dist) * cardRadius;
          const x2 = coreCx - (dx / dist) * coreRadius;
          const y2 = coreCy - (dy / dist) * coreRadius;

          next.push({
            id: connection.id,
            tone: connection.tone,
            x1,
            x2,
            y1,
            y2,
          });
        }
        setResolved(next);
      });
    };

    observer = new ResizeObserver(() => scheduleResolve());
    observer.observe(container);

    scheduleResolve();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    };
  }, [connections, coreNode, cardNodes]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 hidden lg:block",
        className,
      )}
      ref={containerRef}
    >
      <svg className="h-full w-full">
        <defs>
          {resolved.map((connection) => {
            const stops = gradientStop(connection.tone);
            return (
              <linearGradient
                id={`hud-line-${connection.id}`}
                key={`grad-${connection.id}`}
                x1="0%"
                x2="100%"
                y1="0%"
                y2="0%"
              >
                <stop offset="0%" stopColor={stops.from} stopOpacity="0.9" />
                <stop offset="100%" stopColor={stops.to} stopOpacity="0.9" />
              </linearGradient>
            );
          })}
        </defs>
        {resolved.map((connection) => {
          const dx = connection.x2 - connection.x1;
          const dy = connection.y2 - connection.y1;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const ux = dx / dist;
          const uy = dy / dist;
          const midX = connection.x1 + ux * Math.min(CORNER_RADIUS, dist / 3);
          const midY = connection.y1 + uy * Math.min(CORNER_RADIUS, dist / 3);
          const endX = connection.x2 - ux * Math.min(CORNER_RADIUS, dist / 3);
          const endY = connection.y2 - uy * Math.min(CORNER_RADIUS, dist / 3);

          const path = `M ${connection.x1} ${connection.y1} L ${midX} ${midY} Q ${connection.x1 + ux * CORNER_RADIUS * 1.6} ${connection.y1 + uy * CORNER_RADIUS * 1.6}, ${connection.x1 + ux * CORNER_RADIUS * 2.2} ${connection.y1 + uy * CORNER_RADIUS * 2.2} T ${endX} ${endY} L ${connection.x2} ${connection.y2}`;

          return (
            <g key={`line-${connection.id}`}>
              <path
                className={cn(connectionStrokeClass(connection.tone), "hud-line-fill")}
                d={path}
                fill="none"
                stroke={`url(#hud-line-${connection.id})`}
                strokeLinecap="round"
                strokeWidth={STROKE_WIDTH}
              />
              <circle
                cx={connection.x1}
                cy={connection.y1}
                fill="rgba(34,211,238,0.85)"
                r={NODE_RADIUS}
              />
              <circle
                cx={connection.x2}
                cy={connection.y2}
                fill="rgba(34,211,238,0.85)"
                r={NODE_RADIUS}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Helper hook that owns the registry of card nodes. Components register
 * a card by calling `registerSource(id)` and passing the resulting
 * ref-setter to their card element. The hook returns the live map plus
 * a function that captures the core node.
 *
 * The `registerSource` factory returns a STABLE callback per id (cached
 * via a ref) so React does not loop infinitely when parents re-render
 * and pass a fresh closure as a ref.
 */
export function useHudElementRegistry() {
  const [cardNodes, setCardNodes] = useState<Map<string, HTMLElement>>(new Map());
  const [coreNode, setCoreNode] = useState<HTMLElement | null>(null);

  // Stable, mutable callback registry keyed by source id. Each entry is
  // a stable function that updates the React state exactly once. We
  // hand out the same callback across re-renders.
  const callbacksRef = useRef<Map<string, (node: HTMLElement | null) => void>>(
    new Map(),
  );

  const getRegister = useCallback(
    (id: string) => {
      const existing = callbacksRef.current.get(id);
      if (existing) return existing;
      const setter = (node: HTMLElement | null) => {
        setCardNodes((current) => {
          const has = current.get(id);
          if (has === node) return current;
          const next = new Map(current);
          if (node) next.set(id, node);
          else next.delete(id);
          return next;
        });
      };
      callbacksRef.current.set(id, setter);
      return setter;
    },
    [],
  );

  const registerSource = useCallback(
    (id: string) => getRegister(id),
    [getRegister],
  );

  const registerCore = useCallback((node: HTMLElement | null) => {
    setCoreNode(node);
  }, []);

  // Cleanup: when the component unmounts the registry is garbage
  // collected automatically by React.
  useEffect(() => {
    const registry = callbacksRef.current;
    return () => {
      registry.clear();
    };
  }, []);

  return { cardNodes, coreNode, registerCore, registerSource };
}