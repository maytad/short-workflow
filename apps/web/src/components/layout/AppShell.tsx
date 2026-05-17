import { Link } from "@tanstack/react-router";
import { Boxes, Home, Workflow } from "lucide-react";
import type { PropsWithChildren, ReactNode } from "react";

import { cn } from "../../lib/utils";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link className="flex items-center gap-2 font-semibold" to="/">
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Workflow className="size-4" aria-hidden="true" />
            </span>
            <span>Short Workflow</span>
          </Link>

          <nav className="flex items-center gap-1" aria-label="Primary">
            <NavLink icon={<Home className="size-4" />} label="Projects" to="/" />
            <NavLink
              icon={<Boxes className="size-4" />}
              label="Queue"
              to="/"
            />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

type NavLinkProps = {
  icon: ReactNode;
  label: string;
  to: "/";
};

function NavLink({ icon, label, to }: NavLinkProps) {
  return (
    <Link
      activeProps={{
        className: "bg-muted text-foreground",
      }}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
      )}
      to={to}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
