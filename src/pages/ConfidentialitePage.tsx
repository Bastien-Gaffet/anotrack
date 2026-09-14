import { Link } from "react-router";

export default function ConfidentialitePage() {
  return (
    <div className="max-w-2xl py-16">
      <p className="label-mono text-accent">Données &amp; confidentialité</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
        Qui voit quoi, et pourquoi.
      </h1>
      <p className="mt-6 text-[15px] leading-relaxed text-foreground/65">
        AnoTrack est un outil interne à la classe : il permet de connaître son
        rang à un DS sans révéler les notes de chacun. Cette page explique,
        en toute transparence, quelles données sont stockées et comment elles
        sont protégées.
      </p>

      <section className="mt-12 border-t border-foreground/15 pt-10">
        <h2 className="text-2xl font-semibold">Données collectées</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-foreground/70">
          <li>Les <strong>noms et prénoms</strong> des élèves (liste de classe saisie par l'admin) — nécessaires pour que chacun se sélectionne au dépôt.</li>
          <li>Les <strong>notes</strong> déposées, associées à un numéro anonyme.</li>
          <li>Le <strong>numéro anonyme permanent</strong> de chaque élève (tiré au sort).</li>
          <li>Le <strong>code personnel</strong> de chaque élève — stocké uniquement sous forme <strong>hachée</strong> (illisible, même pour l'admin).</li>
        </ul>
        <p className="mt-4 text-[15px] leading-relaxed text-foreground/70">
          Aucune donnée de navigation n'est collectée : pas de cookies de suivi,
          pas d'analytics, pas de publicité. Le site utilise uniquement le
          stockage local du navigateur pour mémoriser la session admin.
        </p>
      </section>

      <section className="mt-12 border-t border-foreground/15 pt-10">
        <h2 className="text-2xl font-semibold">Qui a accès à quoi</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-foreground/70">
          <li><strong>Tout le monde</strong> peut voir : la liste des DS, la progression des saisies, et une fois publié, le classement anonyme (numéro, note, rang) et les statistiques.</li>
          <li><strong>Chaque élève</strong> ne voit sa propre note et son numéro qu'avec son code personnel.</li>
          <li><strong>L'admin</strong> voit la liste de classe et qui a déposé (ou non) sa note — mais <strong>jamais la correspondance nom ↔ note</strong> : le site est construit pour ne pas la montrer.</li>
        </ul>
      </section>

      <section className="mt-12 border-t border-foreground/15 pt-10">
        <h2 className="text-2xl font-semibold">Base légale &amp; durée</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-foreground/70">
          Le traitement repose sur l'<strong>intérêt légitime</strong> de la classe
          (organisation interne, information des élèves sur leurs résultats) —
          article 6.1.f du RGPD. Les données d'un DS sont conservées jusqu'à sa
          suppression par l'admin, et au plus tard jusqu'à la fin de l'année
          scolaire.
        </p>
      </section>

      <section className="mt-12 border-t border-foreground/15 pt-10">
        <h2 className="text-2xl font-semibold">Tes droits</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-foreground/70">
          Conformément au RGPD, chaque élève dispose d'un droit d'accès, de
          rectification et d'effacement de ses données. En pratique :
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-foreground/70">
          <li><strong>Accès / rectification</strong> : ta note et ton numéro sont consultables et modifiables avec ton code personnel, tant que les saisies sont ouvertes.</li>
          <li><strong>Effacement</strong> : demande à l'admin la suppression de ta note ou de ton nom de la liste — c'est immédiat.</li>
          <li><strong>Code oublié</strong> : l'admin peut réinitialiser ton code personnel.</li>
        </ul>
      </section>

      <section className="mt-12 border-t border-foreground/15 pt-10">
        <h2 className="text-2xl font-semibold">Hébergement &amp; sécurité</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-foreground/70">
          Le site est hébergé et administré par un élève de la classe. Les
          échanges sont chiffrés (HTTPS) et les codes personnels sont hachés.
          Aucune donnée n'est vendue, partagée ou transmise à des tiers.
        </p>
      </section>

      <p className="mt-12">
        <Link to="/" className="btn-ink inline-block">
          ← Retour aux DS
        </Link>
      </p>
    </div>
  );
}
