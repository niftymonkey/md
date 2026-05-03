/**
 * Builds the inline script string for `next/script` `beforeInteractive`
 * pre-hydration. Two responsibilities:
 *
 *   - Apply the user's reader preferences (width, outline auto-show) before
 *     first paint, to avoid a flash of wrong state.
 *   - Apply UA-detected platform + dev theme switcher state.
 *
 * For authed users, layout.tsx renders authoritative `<html>` data-attrs
 * server-side from `getUserPreferences`. The localStorage reads are skipped
 * so stale client values can't override the server's decision. Unauthed
 * readers (public links) keep the localStorage path as their only state.
 */
export function buildPreHydrationScript(authed: boolean): string {
  const localStorageReaderPrefs = `var w=localStorage.getItem('md.width');if(w==='wide')document.documentElement.setAttribute('data-width','wide');var o=localStorage.getItem('md.outline.shown');if(o==='false')document.documentElement.setAttribute('data-outline-hidden','1');`;

  const devThemeAndPlatform = `var t=localStorage.getItem('md.dev-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-dev-theme',t);}var ua=navigator.userAgent||'';var p=(navigator.userAgentData&&navigator.userAgentData.platform)||'';if(/Mac|iPhone|iPad/.test(ua)||/macOS|iOS/.test(p))document.documentElement.setAttribute('data-platform','mac');`;

  const body = authed
    ? devThemeAndPlatform
    : `${localStorageReaderPrefs}${devThemeAndPlatform}`;

  return `(function(){try{${body}}catch(e){}})();`;
}
