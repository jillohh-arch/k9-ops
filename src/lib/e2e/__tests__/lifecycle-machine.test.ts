import { describe, expect, it } from "vitest";

import {
  LifecycleStateMachine,
  SUCCESSFUL_LIFECYCLE,
} from "../lifecycle-machine";

describe("HW-2 lifecycle state machine", () => {
  it("accepts only the required successful order", () => {
    const machine = new LifecycleStateMachine();
    for (const state of SUCCESSFUL_LIFECYCLE.slice(1)) {
      machine.transition(state);
    }
    expect(machine.state).toBe("finished");
    expect(machine.history).toEqual(SUCCESSFUL_LIFECYCLE);
  });

  it("rejects skipping seed validation", () => {
    const machine = new LifecycleStateMachine();
    machine.transition("ports_verified");
    machine.transition("emulators_started");
    machine.transition("emulators_ready");
    expect(() => machine.transition("nextjs_started")).toThrow(
      /expected seed_validated/,
    );
  });

  it("rejects finishing before ports are released", () => {
    const machine = new LifecycleStateMachine();
    expect(() => machine.transition("finished")).toThrow(/ports_verified/);
  });
});
