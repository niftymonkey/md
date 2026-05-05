// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RestoreButton } from "./restore-button";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("RestoreButton", () => {
  it("renders the rest label", () => {
    render(<RestoreButton onConfirm={() => {}} />);
    expect(
      screen.getByRole("button", { name: /restore this version/i }),
    ).toBeInTheDocument();
  });

  it("on first click, swaps to the confirm label with a 3-second countdown", () => {
    render(<RestoreButton onConfirm={() => {}} />);
    fireEvent.click(screen.getByRole("button"));
    expect(
      screen.getByRole("button", { name: /confirm restore \(3\)/i }),
    ).toBeInTheDocument();
  });

  it("calls onConfirm only on the second click while in the confirming phase", () => {
    const onConfirm = vi.fn();
    render(<RestoreButton onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("ticks the countdown down each second", () => {
    render(<RestoreButton onConfirm={() => {}} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent(/\(3\)/);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("button")).toHaveTextContent(/\(2\)/);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("button")).toHaveTextContent(/\(1\)/);
  });

  it("reverts to the rest label after the countdown lapses", () => {
    const onConfirm = vi.fn();
    render(<RestoreButton onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button"));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(
      screen.getByRole("button", { name: /restore this version/i }),
    ).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
