import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

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
  /** Polyline points (x, y) — already rotated correctly. */
  points: Array<{ x: number; y: number }>;
  /** Total path length in pixels (for the travelling dot). */
  length: number;
}

const NODE_RADIUS_OUT = 3.5;
const NODE_RADIUS_IN = 4;
const STROKE_WIDTH = 1.25;

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
        const coreRadius = coreRect.width / 2 - 4;

        const next: ResolvedConnection[] = [];
        for (const connection of connections) {
          const node = cardNodes.get(connection.id);
          if (!node) continue;
          const rect = node.getBoundingClientRect();

          // Pick the closest vertical edge of the card to the core.
          const isLeftCard = (coreRect.left + coreRect.width / 2) > (rect.left + rect.width / 2);
          const exitX = isLeftCard
            ? rect.right - bounds.left
            : rect.left - bounds.left;
          const exitY = rect.top + rect.height / 2 - bounds.top;

          let points: Array<{ x: number; y: number }> = [];

          if (isLeftCard) {
            // Left card connection: exits right, stops at the outer edge of the Canvas container
            const entryX = coreCx - 144;
            points = [
              { x: exitX, y: exitY },
              { x: entryX, y: exitY },
            ];
          } else {
            // Right cards connection: exits left, stops at the outer edge of the Canvas container
            const entryX = coreCx + 144;
            points = [
              { x: exitX, y: exitY },
              { x: entryX, y: exitY },
            ];
          }

          let length = 0;
          for (let i = 1; i < points.length; i += 1) {
            const a = points[i - 1];
            const b = points[i];
            if (a && b) {
              length += Math.hypot(b.x - a.x, b.y - a.y);
            }
          }

          next.push({
            id: connection.id,
            length,
            points,
            tone: connection.tone,
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
      <svg className="h-full w-full overflow-visible">
        <defs>
          <filter id="hud-line-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {resolved.map((connection) => {
          const pathD = connection.points
            .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
            .join(" ");

          const first = connection.points[0];
          const last = connection.points[connection.points.length - 1];

          // Map tone to ciano or roxo
          const color = connection.tone === "violet" || connection.tone === "amber"
            ? "#8A2BE2" // Purple
            : "#00FFFF"; // Cyan

          return (
            <g key={`line-${connection.id}`}>
              {/* Neon Glow path */}
              <motion.path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth={3}
                opacity={0.25}
                filter="url(#hud-line-glow)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.8, ease: "easeInOut" }}
              />

              {/* Inner Sharp Laser path */}
              <motion.path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
              />

              {/* Travelling neon pulse dot */}
              <circle r="2.2" fill="#ffffff" filter="url(#hud-line-glow)">
                <animateMotion
                  dur="4s"
                  repeatCount="indefinite"
                  path={pathD}
                />
              </circle>
              <circle r="4" fill="none" stroke={color} strokeWidth="1" opacity="0.6">
                <animateMotion
                  dur="4s"
                  repeatCount="indefinite"
                  path={pathD}
                />
              </circle>

              {first && (
                <g>
                  {/* Outer glow ring around the node */}
                  <motion.circle
                    cx={first.x}
                    cy={first.y}
                    r={NODE_RADIUS_OUT + 2.5}
                    fill="none"
                    stroke={color}
                    strokeWidth={1}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 0.6 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                  />
                  {/* Inner solid node */}
                  <motion.circle
                    cx={first.x}
                    cy={first.y}
                    r={NODE_RADIUS_OUT - 1.5}
                    fill="#ffffff"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.8, duration: 0.3 }}
                  />
                </g>
              )}

              {last && (
                <g>
                  {/* Core entry glowing node */}
                  <motion.circle
                    cx={last.x}
                    cy={last.y}
                    r={NODE_RADIUS_IN + 3}
                    fill={color}
                    opacity={0.35}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1.2, duration: 0.4 }}
                  />
                  <motion.circle
                    cx={last.x}
                    cy={last.y}
                    r={NODE_RADIUS_IN}
                    fill={color}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1.4, duration: 0.3 }}
                  />
                </g>
              )}
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