"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export default function GaPageView() {
  const pathname = usePathname();

  useEffect(() => {
    const search = window.location.search || "";
    const url = `${pathname}${search}`;

    window.gtag?.("event", "page_view", {
      page_path: url,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname]);

  return null;
}
