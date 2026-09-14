import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import Stamp from "@/components/Stamp";

export default function Home() {
  const exams = trpc.ano.listExams.useQuery(undefined, {
    refetchInterval: 15000,
  });

  return (
    <div>
      {/* Hero */}
      <section className="pb-16 pt-16 md:pt-24">
        <p className="label-mono text-accent">Prépa — classement anonyme</p>
        <h1 className="mt-6 max-w-2xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
          Ta note.
          <br />
          Ton rang.
          <br />
          <span className="italic text-foreground/60">Personne d'autre.</span>
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-foreground/70">
          Le prof a donné les notes mais pas le classement&nbsp;? Ici, chacun
          dépose sa note, reçoit un numéro anonyme, et quand tout le monde a
          joué le jeu, le classement complet est publié — sans aucun nom.
        </p>
      </section>

      {/* Comment ça marche */}
      <section className="border-t border-foreground/15 py-14">
        <p className="label-mono text-foreground/50">Comment ça marche</p>
        <div className="mt-8 grid gap-10 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Tu déposes ta note",
              text: "Choisis ton nom dans la liste de la classe et rentre ta note. Personne d'autre ne la verra jamais.",
            },
            {
              n: "02",
              title: "Tu reçois ton numéro",
              text: "Un numéro anonyme tiré au sort une fois pour toutes — le même à chaque DS. Un seul numéro à retenir pour toute l'année.",
            },
            {
              n: "03",
              title: "Le classement tombe",
              text: "Quand tout le monde a répondu (ou quand l'admin le décide), le tableau rang / n° / note est publié.",
            },
          ].map((s) => (
            <div key={s.n}>
              <p className="label-mono tnum text-accent">{s.n}</p>
              <h3 className="mt-3 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/65">
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Liste des DS */}
      <section className="border-t border-foreground/15 py-14">
        <div className="flex items-baseline justify-between">
          <p className="label-mono text-foreground/50">Les DS</p>
          {exams.data && (
            <p className="label-mono tnum text-foreground/40">
              {exams.data.length} au total
            </p>
          )}
        </div>

        <div className="mt-6">
          {exams.isLoading && (
            <p className="label-mono py-10 text-foreground/40">Chargement…</p>
          )}

          {exams.data?.length === 0 && (
            <div className="border border-dashed border-foreground/30 px-6 py-14 text-center">
              <p className="text-2xl font-semibold italic text-foreground/60">
                Aucun DS pour l'instant.
              </p>
              <p className="label-mono mt-3 text-foreground/40">
                Le premier apparaîtra ici dès qu'il sera créé
              </p>
            </div>
          )}

          {exams.data?.map((exam) => {
            const isNew =
              exam.status === "published" &&
              exam.publishedAt &&
              Date.now() - new Date(exam.publishedAt).getTime() <
                7 * 24 * 3600 * 1000;
            return (
            <Link
              key={exam.id}
              to={`/ds/${exam.id}`}
              className="group flex items-center gap-4 border-b border-foreground/15 py-5 transition-colors hover:bg-foreground/[0.03] md:gap-8"
            >
              <div className="w-28 shrink-0">
                <p className="label-mono truncate text-foreground/50">
                  {exam.subject}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-xl font-semibold md:text-2xl">
                  {exam.title}
                </h3>
                <p className="label-mono tnum mt-1 text-foreground/40">
                  {exam.submissionCount}/{exam.expectedCount} notes · barème{" "}
                  {exam.maxPoints}
                  {exam.classMean !== null && exam.classMean !== undefined && (
                    <span className="text-accent">
                      {" "}· moy. {exam.classMean}/{exam.maxPoints}
                    </span>
                  )}
                </p>
              </div>
              {isNew ? (
                <span className="stamp text-accent">Nouveau !</span>
              ) : (
                <Stamp status={exam.status} />
              )}
              <span className="hidden text-2xl text-foreground/30 transition-transform group-hover:translate-x-1 group-hover:text-foreground md:inline">
                →
              </span>
            </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
