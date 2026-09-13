/** Remounts on every route change, so each page fades in instead of
 * snapping. Layout stays put; only the page content animates. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-in fade-in duration-200">{children}</div>;
}
