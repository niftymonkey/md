import { describe, expect, it } from "vitest";
import { initial, reduce, type State } from "./restore-confirm-state";

describe("restore-confirm-state — initial", () => {
  it("starts in the idle phase", () => {
    expect(initial).toEqual({ phase: "idle" });
  });
});

describe("restore-confirm-state — click from idle", () => {
  it("enters the confirming phase with 3 seconds remaining", () => {
    expect(reduce(initial, { type: "click" })).toEqual({
      phase: "confirming",
      secondsLeft: 3,
    });
  });
});

describe("restore-confirm-state — tick during countdown", () => {
  it("decrements secondsLeft", () => {
    const state: State = { phase: "confirming", secondsLeft: 3 };
    expect(reduce(state, { type: "tick" })).toEqual({
      phase: "confirming",
      secondsLeft: 2,
    });
  });

  it("reverts to idle when the countdown reaches zero", () => {
    const state: State = { phase: "confirming", secondsLeft: 1 };
    expect(reduce(state, { type: "tick" })).toEqual({ phase: "idle" });
  });
});

describe("restore-confirm-state — cancel", () => {
  it("returns to idle from confirming", () => {
    const state: State = { phase: "confirming", secondsLeft: 2 };
    expect(reduce(state, { type: "cancel" })).toEqual({ phase: "idle" });
  });

  it("is a no-op from idle", () => {
    expect(reduce(initial, { type: "cancel" })).toEqual({ phase: "idle" });
  });
});

describe("restore-confirm-state — second click while confirming", () => {
  it("is a no-op for the reducer; the consumer detects the click and commits", () => {
    const state: State = { phase: "confirming", secondsLeft: 2 };
    expect(reduce(state, { type: "click" })).toBe(state);
  });
});
