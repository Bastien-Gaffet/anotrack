import { useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import { trpc } from "@/providers/trpc";
import Stamp from "@/components/Stamp";

function formatGrade(g: number) {
  return Number.isInteger(g) ? String(g) : g.toFixed(2).replace(/0$/, "");
}

/* ------------------------- Dépôt / modification ------------------------- */

function SubmitSection({ examId, maxPoints }: { examId: number; maxPoints: number }) {
  const utils = trpc.useUtils();
  const roster = trpc.ano.roster.useQuery();
  const [studentId, setStudentId] = useState("");
  const [grade, setGrade] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    anonNumber: number;
    updated: boolean;
    autoPublished: boolean;
    firstEver: boolean;
  } | null>(null);

  const submit = trpc.ano.submitGrade.useMutation({
    onSuccess: (data) => {
      setReceipt(data);
      setError(null);
      setSecret("");
      utils.ano.listExams.invalidate();
      utils.ano.getExam.invalidate({ id: examId });
      utils.ano.results.invalidate({ id: examId });
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const g = parseFloat(grade.replace(",", "."));
    if (!studentId) return setError("Choisis ton nom dans la liste.");
    if (Number.isNaN(g) || g < 0 || g > maxPoints)
      return setError(`La note doit être comprise entre 0 et ${maxPoints}.`);
    if (secret.trim().length < 4)
      return setError("Ton code personnel doit faire au moins 4 caractères.");
    submit.mutate({
      examId,
      studentId: Number(studentId),
      grade: g,
      secret: secret.trim(),
    });
  };

  if (receipt) {
    return (
      <section className="border-t border-foreground/15 py-14">
        <p className="label-mono text-foreground/50">
          {receipt.updated ? "Note mise à jour" : "Note enregistrée"}
        </p>
        <div className="mt-8 border-2 border-foreground px-6 py-12 text-center">
          <p className="label-mono text-foreground/50">
            Ton numéro anonyme — le même pour tous les DS
          </p>
          <p className="tnum mt-4 text-8xl font-semibold tracking-tight text-accent md:text-9xl">
            {receipt.anonNumber}
          </p>
          <p className="mx-auto mt-6 max-w-md text-[15px] leading-relaxed text-foreground/70">
            {receipt.firstEver ? (
              <>
                <strong>Ton numéro et ton code personnel sont créés.</strong>{" "}
                Le numéro est le même à chaque DS — c'est comme ça que tu te
                reconnaîtras dans tous les classements. Le code te sert à
                déposer, modifier et retrouver ta note.
              </>
            ) : (
              <>
                C'est avec ce numéro que tu te reconnaîtras dans le classement
                — il est le même à chaque DS. Et ton code personnel te rend ta
                note à tout moment.
              </>
            )}
          </p>
          {receipt.autoPublished && (
            <p className="label-mono mt-6 text-accent">
              Toutes les notes sont là — le classement vient d'être publié ↓
            </p>
          )}
        </div>
        <button
          className="btn-ink mt-6"
          onClick={() => {
            setReceipt(null);
            setGrade("");
          }}
        >
          OK, c'est noté
        </button>
      </section>
    );
  }

  return (
    <section className="border-t border-foreground/15 py-14">
      <p className="label-mono text-foreground/50">Rentre ta note</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight">
        Dépose ta note, prends ton numéro.
      </h2>

      <form onSubmit={handleSubmit} className="mt-10 max-w-md space-y-6">
        <div>
          <label className="label-mono mb-2 block text-foreground/60">
            Ton nom
          </label>
          <select
            className="input-ink"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">— choisis dans la liste —</option>
            {roster.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {roster.data?.length === 0 && (
            <p className="label-mono mt-2 text-accent">
              La liste de classe n'est pas encore renseignée — préviens l'admin.
            </p>
          )}
        </div>

        <div>
          <label className="label-mono mb-2 block text-foreground/60">
            Ta note / {maxPoints}
          </label>
          <input
            className="input-ink tnum text-2xl"
            inputMode="decimal"
            placeholder="ex : 12,5"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          />
        </div>

        <div>
          <label className="label-mono mb-2 block text-foreground/60">
            Ton code personnel
          </label>
          <input
            type="password"
            className="input-ink"
            placeholder="au moins 4 caractères"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <p className="mt-2 text-[13px] italic leading-relaxed text-foreground/50">
            La première fois, tu le choisis — ensuite c'est le même pour tous
            les DS. Il te sert à déposer, modifier ta note et retrouver ton
            numéro. Toi seul·e le connais.
          </p>
        </div>

        {error && (
          <p className="border-l-2 border-accent pl-4 text-[15px] text-accent">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn-accent w-full md:w-auto"
          disabled={submit.isPending}
        >
          {submit.isPending ? "Envoi…" : "Déposer ma note"}
        </button>
        <p className="text-[13px] italic text-foreground/45">
          Déjà déposé une note pour ce DS ? Renvoie-la avec le même code : elle
          sera remplacée, et ton numéro — le même à chaque DS — ne change pas.
        </p>
      </form>
    </section>
  );
}

/* --------------------- Ma note / mon numéro (code) ----------------------- */

function MyInfos({ examId, maxPoints }: { examId: number; maxPoints: number }) {
  const roster = trpc.ano.roster.useQuery();
  const [studentId, setStudentId] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<{ anonNumber: number; grade: number } | null>(null);

  const query = trpc.ano.myGrade.useMutation({
    onSuccess: (data) => {
      setFound(data);
      setError(null);
    },
    onError: (e) => {
      setFound(null);
      setError(e.message);
    },
  });

  return (
    <details className="group border-t border-foreground/15 py-8">
      <summary className="label-mono cursor-pointer list-none text-foreground/50 hover:text-foreground">
        <span className="group-open:hidden">
          + Retrouver ma note / mon numéro
        </span>
        <span className="hidden group-open:inline">
          − Retrouver ma note / mon numéro
        </span>
      </summary>
      <p className="mt-4 max-w-md text-[14px] italic leading-relaxed text-foreground/55">
        Ton nom + ton code personnel. Le code est connu de toi seul :
        impossible de consulter la note ou le numéro de quelqu'un d'autre.
      </p>
      <form
        className="mt-6 flex max-w-md flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setFound(null);
          if (!studentId || !secret.trim())
            return setError("Indique ton nom et ton code personnel.");
          query.mutate({
            examId,
            studentId: Number(studentId),
            secret: secret.trim(),
          });
        }}
      >
        <select
          className="input-ink"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          <option value="">— ton nom —</option>
          {roster.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="password"
          className="input-ink"
          placeholder="ton code personnel"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
        {error && (
          <p className="border-l-2 border-accent pl-4 text-[15px] text-accent">
            {error}
          </p>
        )}
        {found && (
          <div className="border-2 border-foreground px-5 py-6 text-center">
            <p className="label-mono text-foreground/50">
              Ton numéro anonyme pour ce DS
            </p>
            <p className="tnum mt-2 text-6xl font-semibold text-accent">
              {found.anonNumber}
            </p>
            <p className="mt-2 text-[15px] text-foreground/60">
              ta note :{" "}
              <strong className="tnum">
                {formatGrade(found.grade)}/{maxPoints}
              </strong>
            </p>
          </div>
        )}
        <button type="submit" className="btn-ink w-fit" disabled={query.isPending}>
          {query.isPending ? "Recherche…" : "Afficher"}
        </button>
      </form>
    </details>
  );
}

/* ------------------------------ Classement ------------------------------ */

function ResultsSection({ examId, maxPoints }: { examId: number; maxPoints: number }) {
  const results = trpc.ano.results.useQuery(
    { id: examId },
    { refetchInterval: 15000 },
  );
  const [myNumber, setMyNumber] = useState("");

  const myRow = useMemo(() => {
    if (!results.data?.published || !myNumber) return null;
    return (
      results.data.rows.find((r) => r.anonNumber === Number(myNumber)) ?? null
    );
  }, [results.data, myNumber]);

  if (!results.data?.published) return null;

  const { stats, rows } = results.data;

  return (
    <section className="border-t border-foreground/15 py-14">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <p className="label-mono text-accent">Classement publié</p>
        <div className="flex items-center gap-3">
          <input
            className="input-ink tnum w-28 !py-2 text-sm"
            inputMode="numeric"
            placeholder="ton n°"
            value={myNumber}
            onChange={(e) => setMyNumber(e.target.value)}
          />
          <span className="label-mono text-foreground/40">
            ← surligne ta ligne
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-10 grid grid-cols-2 gap-y-8 border-y border-foreground/15 py-8 md:grid-cols-5">
        {[
          { label: "Moyenne", value: formatGrade(stats.mean) },
          { label: "Médiane", value: formatGrade(stats.median) },
          { label: "Plus haute", value: formatGrade(stats.max) },
          { label: "Plus basse", value: formatGrade(stats.min) },
          { label: "Notes", value: String(stats.count) },
        ].map((s) => (
          <div key={s.label}>
            <p className="label-mono text-foreground/40">{s.label}</p>
            <p className="tnum mt-2 text-3xl font-semibold md:text-4xl">
              {s.value}
              {s.label !== "Notes" && (
                <span className="text-base font-normal text-foreground/40">
                  /{maxPoints}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Mise en avant personnelle */}
      {myRow && (
        <p className="mt-8 text-lg">
          Toi&nbsp;: rang{" "}
          <strong className="tnum text-2xl text-accent">{myRow.rank}</strong>{" "}
          avec{" "}
          <strong className="tnum text-2xl text-accent">
            {formatGrade(myRow.grade)}
          </strong>
          /{maxPoints}
        </p>
      )}

      {/* Tableau */}
      <table className="mt-10 w-full">
        <thead>
          <tr className="border-b-2 border-foreground text-left">
            <th className="label-mono py-3 pr-4 font-normal text-foreground/50">
              Rang
            </th>
            <th className="label-mono py-3 pr-4 font-normal text-foreground/50">
              N° anonyme
            </th>
            <th className="label-mono py-3 text-right font-normal text-foreground/50">
              Note /{maxPoints}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.anonNumber}
              className={`rank-row ${r.anonNumber === Number(myNumber) && myNumber ? "me" : ""}`}
            >
              <td className="tnum py-3 pr-4 text-lg font-semibold md:text-xl">
                {r.rank}
                {r.rank === 1 && <span className="ml-2 text-accent">★</span>}
              </td>
              <td
                className="tnum py-3 pr-4 text-lg md:text-xl"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                n°{r.anonNumber}
              </td>
              <td className="tnum py-3 text-right text-lg md:text-xl">
                {formatGrade(r.grade)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* -------------------------------- Page ---------------------------------- */

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const examId = Number(id);
  const exam = trpc.ano.getExam.useQuery(
    { id: examId },
    { refetchInterval: 15000, enabled: Number.isFinite(examId) },
  );

  if (exam.isLoading) {
    return <p className="label-mono py-24 text-foreground/40">Chargement…</p>;
  }
  if (exam.error || !exam.data) {
    return (
      <div className="py-24">
        <p className="text-3xl font-semibold italic">DS introuvable.</p>
        <Link to="/" className="btn-ink mt-8 inline-block">
          ← Retour aux DS
        </Link>
      </div>
    );
  }

  const e = exam.data;
  const progress = Math.min(
    100,
    Math.round((e.submissionCount / Math.max(1, e.expectedCount)) * 100),
  );

  return (
    <div>
      {/* En-tête du DS */}
      <section className="pb-12 pt-12 md:pt-16">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="label-mono text-foreground/40 hover:text-foreground"
          >
            ← Les DS
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="label-mono text-accent">{e.subject}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">
              {e.title}
            </h1>
          </div>
          <Stamp status={e.status} />
        </div>

        {/* Progression */}
        <div className="mt-10">
          <div className="flex items-baseline justify-between">
            <p className="label-mono text-foreground/50">
              {e.submissionCount}/{e.expectedCount} notes reçues
            </p>
            <p className="label-mono tnum text-foreground/40">{progress}%</p>
          </div>
          <div className="mt-3 h-[3px] w-full bg-foreground/10">
            <div
              className="h-full bg-accent transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          {e.status === "open" && (
            <p className="mt-3 text-[15px] italic text-foreground/55">
              Publication automatique dès que les {e.expectedCount} notes sont
              rentrées.
            </p>
          )}
        </div>
      </section>

      {e.status === "open" && (
        <SubmitSection examId={e.id} maxPoints={e.maxPoints} />
      )}

      {e.status === "closed" && (
        <section className="border-t border-foreground/15 py-14">
          <p className="text-3xl font-semibold italic text-foreground/60">
            Les saisies sont fermées.
          </p>
          <p className="mt-3 text-foreground/60">
            L'admin n'a pas encore publié le classement — ça ne saurait tarder.
          </p>
        </section>
      )}

      <MyInfos examId={e.id} maxPoints={e.maxPoints} />

      {e.status === "published" && (
        <ResultsSection examId={e.id} maxPoints={e.maxPoints} />
      )}
    </div>
  );
}
