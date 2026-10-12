"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/ui/Logo";
export function PilotShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path.startsWith("/pilot/label/")) return <>{children}</>;
  const customer = ["/pilot/account", "/pilot/tracking", "/pilot/sign-in"].some(
    (p) => path === p || path.startsWith(p + "/"),
  );
  const links = customer
    ? [
        ["My Shipping", "/pilot/account"],
        ["Tracking", "/pilot/tracking"],
        ["Customer sign in", "/pilot/sign-in"],
      ]
    : [
        ["Operations", "/pilot/operations"],
        ["Warehouse", "/pilot"],
        ["Customers", "/pilot/customers"],
      ];
  return (
    <div className="pilot-ui">
      <a
        href="#pilot-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-3"
      >
        Skip to content
      </a>
      <div className="pilot-banner">
        <div>
          <strong>PILOT WORKSPACE</strong>
          <span>Your shipping, all connected.</span>
          <span className="pilot-mode">
            {customer ? "Customer account" : "Staff operations"}
          </span>
        </div>
      </div>
      <header className="pilot-site-header">
        <div>
          <Link
            href={customer ? "/pilot/account" : "/pilot/operations"}
            className="pilot-brand"
            aria-label="Shipping OS pilot home"
          >
            <LogoMark className="h-9 w-9" />
            <span>SHIPPING OS</span>
          </Link>
          <nav aria-label="Pilot navigation">
            {links.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                aria-current={path === href ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Link
            className="pilot-account-link"
            href={customer ? "/pilot/account" : "/pilot/operations"}
          >
            <span aria-hidden>{customer ? "↗" : "★"}</span>
            {customer ? "My Shipping" : "Workspace"}
          </Link>
        </div>
      </header>
      <div id="pilot-content">{children}</div>
      <footer className="pilot-footer">
        <div>
          <div className="pilot-brand">
            <LogoMark className="h-8 w-8" />
            <span>SHIPPING OS</span>
          </div>
          <p>From checkout to your doorstep. We handle the rest.</p>
          <p className="pilot-footer-note">
            PCL Imports pilot · Your packages, documents and shipping team in
            one place.
          </p>
        </div>
      </footer>
    </div>
  );
}
