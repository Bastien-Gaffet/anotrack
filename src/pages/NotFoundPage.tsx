import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="py-20 md:py-28">
      <p className="label-mono text-accent">Page introuvable</p>

      <div className="mt-8 border-2 border-foreground px-6 py-14 text-center md:py-20">
        <p className="label-mono text-foreground/50">
          Numéro d'anonymat demandé
        </p>
        <p className="tnum mt-4 text-8xl font-semibold tracking-tight text-accent md:text-9xl">
          404
        </p>
        <p className="mx-auto mt-8 max-w-md text-[15px] leading-relaxed text-foreground/70">
          Ce numéro n'a pas été tiré au sort — la page que tu cherches
          n'existe pas (ou plus). Elle a peut-être été dépubliée, ou l'adresse
          est mal recopiée.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link to="/" className="btn-ink">
          ← Retour aux DS
        </Link>
        <Link to="/evolution" className="btn-accent">
          Mon évolution
        </Link>
      </div>
    </div>
  );
}
