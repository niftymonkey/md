export type State = { phase: "idle" } | { phase: "confirming"; secondsLeft: number };

export type Event = { type: "click" } | { type: "tick" } | { type: "cancel" };

export const initial: State = { phase: "idle" };

const COUNTDOWN_SECONDS = 3;

export function reduce(state: State, event: Event): State {
  if (state.phase === "idle" && event.type === "click") {
    return { phase: "confirming", secondsLeft: COUNTDOWN_SECONDS };
  }
  if (state.phase === "confirming" && event.type === "tick") {
    if (state.secondsLeft <= 1) return { phase: "idle" };
    return { phase: "confirming", secondsLeft: state.secondsLeft - 1 };
  }
  if (state.phase === "confirming" && event.type === "cancel") {
    return { phase: "idle" };
  }
  return state;
}
