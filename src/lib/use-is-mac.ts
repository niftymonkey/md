"use client";

import { useEffect, useState } from "react";

export function useIsMac(): boolean {
  const [mac, setMac] = useState(true);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent;
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData?.platform ?? "";
    setMac(/Mac|iPhone|iPad/.test(ua) || /macOS|iOS/.test(platform));
  }, []);
  return mac;
}
