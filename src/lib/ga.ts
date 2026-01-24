const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export function gaEvent(name: string, params: Record<string, any> = {}) {
  if (!GA_ID) return;
  if (typeof window === "undefined") return;
  window.gtag?.("event", name, params);
}
