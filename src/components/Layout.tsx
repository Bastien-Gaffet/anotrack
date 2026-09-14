import { Link, useLocation } from "react-router";
import type { ReactNode } from "react";

function BinderHoles() {
  return (
    <div className="pointer-events-none fixed inset-y-0 left-0 z-0 hidden w-24 md:block">
      <div className="margin-rule" />
      <div className="absolute inset-y-0 left-3 flex flex-col justify-evenly py-24">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="binder-hole" />
        ))}
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div className="relative min-h-screen">
      <BinderHoles />
      <header className="relative z-10 border-b border-foreground/15">
        <div className="mx-auto flex max-w-4xl items-baseline justify-between px-6 py-5 md:px-10">
          <Link to="/" className="group flex items-baseline gap-3">
            <span className="font-serif-display text-[22px] font-semibold tracking-tight">
              Ano<span className="text-accent">Track</span>
            </span>
            <span className="label-mono hidden text-foreground/50 sm:inline">
              classement anonyme
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              to="/"
              className={`label-mono transition-opacity hover:opacity-60 ${
                location.pathname === "/" ? "text-accent" : ""
              }`}
            >
              Les DS
            </Link>
            <Link
              to="/admin"
              className="label-mono text-foreground/50 transition-opacity hover:opacity-60"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-6 pb-24 md:px-10">
        {children}
      </main>

      <footer className="relative z-10 border-t border-foreground/15">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-6 py-6 md:flex-row md:items-baseline md:justify-between md:px-10">
          <span className="label-mono text-foreground/40">
            AnoTrack — personne ne connaît ta note, sauf toi
          </span>
          <Link
            to="/confidentialite"
            className="label-mono text-foreground/40 transition-opacity hover:opacity-60"
          >
            Données &amp; confidentialité
          </Link>
          <span className="label-mono text-foreground/40">
            un numéro, un rang, rien de plus
          </span>
        </div>
      </footer>
    </div>
  );
}
