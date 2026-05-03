"use client";

import { useState, useTransition } from "react";
import type { UserPreferences, Width } from "@/lib/user-preferences";
import { saveReadingPrefs } from "@/app/settings/actions";

export function ReadingSection({ prefs }: { prefs: UserPreferences }) {
  const [autoShow, setAutoShow] = useState(prefs.autoShowOutline);
  const [width, setWidth] = useState<Width>(prefs.defaultWidth);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function applyDataAttrs(next: { autoShow?: boolean; width?: Width }) {
    if (next.autoShow !== undefined) {
      if (next.autoShow) {
        document.documentElement.removeAttribute("data-outline-hidden");
      } else {
        document.documentElement.setAttribute("data-outline-hidden", "1");
      }
    }
    if (next.width !== undefined) {
      if (next.width === "wide") {
        document.documentElement.setAttribute("data-width", "wide");
      } else {
        document.documentElement.removeAttribute("data-width");
      }
    }
  }

  function persistAutoShow(next: boolean) {
    const previous = autoShow;
    setAutoShow(next);
    applyDataAttrs({ autoShow: next });
    setError(null);
    startTransition(async () => {
      const result = await saveReadingPrefs({ autoShowOutline: next });
      if (!result.ok) {
        setAutoShow(previous);
        applyDataAttrs({ autoShow: previous });
        setError(result.error);
      }
    });
  }

  function persistWidth(next: Width) {
    if (next === width) return;
    const previous = width;
    setWidth(next);
    applyDataAttrs({ width: next });
    setError(null);
    startTransition(async () => {
      const result = await saveReadingPrefs({ defaultWidth: next });
      if (!result.ok) {
        setWidth(previous);
        applyDataAttrs({ width: previous });
        setError(result.error);
      }
    });
  }

  return (
    <section className="settings__section">
      <h2 className="settings__section-h">Reading</h2>

      <div className="settings__row">
        <div className="settings__row-label">
          <div className="settings__row-title">Auto-show outline</div>
          <div className="settings__row-help">
            Reveal the on-page outline on docs with three or more H2 headings.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoShow}
          aria-label="Auto-show outline"
          onClick={() => persistAutoShow(!autoShow)}
          className="settings__toggle"
          data-on={autoShow}
        >
          <span className="settings__toggle-thumb" aria-hidden="true" />
        </button>
      </div>

      <div className="settings__row">
        <div className="settings__row-label">
          <div className="settings__row-title">Default width</div>
          <div className="settings__row-help">
            Applies to every reader view. The R/W toggle in the reader updates
            this preference.
          </div>
        </div>
        <div className="settings__pill" role="group" aria-label="Default width">
          <button
            type="button"
            onClick={() => persistWidth("reading")}
            data-active={width === "reading"}
            aria-pressed={width === "reading"}
          >
            Reading
          </button>
          <button
            type="button"
            onClick={() => persistWidth("wide")}
            data-active={width === "wide"}
            aria-pressed={width === "wide"}
          >
            Wide
          </button>
        </div>
      </div>

      {error && (
        <p className="settings__error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
