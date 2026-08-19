export const SUCCESSFUL_LIFECYCLE = [
  "idle",
  "ports_verified",
  "emulators_started",
  "emulators_ready",
  "seed_validated",
  "nextjs_started",
  "nextjs_ready",
  "playwright_started",
  "playwright_closed",
  "nextjs_stopped",
  "emulators_stopped",
  "ports_released",
  "finished",
] as const;

export type LifecycleState = (typeof SUCCESSFUL_LIFECYCLE)[number];

export class LifecycleStateMachine {
  private currentIndex = 0;
  private visited: LifecycleState[] = [SUCCESSFUL_LIFECYCLE[0]];

  get state() {
    return SUCCESSFUL_LIFECYCLE[this.currentIndex];
  }

  get history() {
    return [...this.visited];
  }

  transition(next: LifecycleState) {
    const expected = SUCCESSFUL_LIFECYCLE[this.currentIndex + 1];
    if (next !== expected) {
      throw new Error(
        `Invalid lifecycle transition ${this.state} -> ${next}; expected ${String(expected)}`,
      );
    }
    this.currentIndex += 1;
    this.visited.push(next);
  }
}
