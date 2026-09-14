import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";

function formatGrade(g: number) {
  return Number.isInteger(g) ? String(g) : g.toFixed(2).replace(/0$/, "");
}

type HistoryItem = {
  examId: number;
  title: string;
  subject: string;
  maxPoints: number;
  status: "open" | "closed" | "published";
  publishedAt: Date | null;
  grade: number;
  anonNumber: number;
  rank: number | null;
  classMean: number | null;
  classCount: number | null;
};

/* --- Courbe de progression (note ramenée à /20 pour comparer les DS) --- */

function TrendChart({ items }: { items: HistoryItem[] }) {
  const pts = items.map((it) => (it.grade / it.maxPoints) * 20);
  const W = 720;
  const H = 260;
  const padL = 40;
  const padR = 20;
  const padT = 24;
  const padB = 34;
  const x = (i: number) =>
    items.length === 1
      ? W / 2
      : padL + (i / (items.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / 20) * (H - padT - padB);

  const path = pts
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-6 w-full" role="img" aria-label="Évolution de tes notes">
      {/* repères 0 / 10 / 20 */}
      {[0, 10, 20].map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(v)}
            y2={y(v)}
            stroke="#1a1612"
            strokeWidth={v === 10 ? 1.5 : 1}
            strokeDasharray={v === 10 ? "4 5" : undefined}
            opacity={0.25}
          />
          <text
            x={padL - 8}
            y={y(v) + 4}
            textAnchor="end"
            fontSize="12"
            fill="#1a1612"
            opacity="0.5"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {v}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#db3358" strokeWidth="3" strokeLinejoin="round" />
      {pts.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="6" fill="#db3358" />
          <text
            x={x(i)}
            y={y(v) - 14}
            textAnchor="middle"
            fontSize="14"
            fontWeight="bold"
            fill="#1a1612"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {formatGrade(items[i].grade)}/{items[i].maxPoints}
          </text>
          <text
            x={x(i)}
            y={H - 10}
            textAnchor="middle"
            fontSize="11"
            fill="#1a1612"
            opacity="0.5"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            {items[i].subject}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* -------------------------------- Page ---------------------------------- */

export default function EvolutionPage() {
  const roster = trpc.ano.roster.useQuery();
  const [studentId, setStudentId] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    anonNumber: number | null;
    history: HistoryItem[];
  } | null>(null);

  const query = trpc.ano.myHistory.useMutation({
    onSuccess: (d) => {
      setData(d as { anonNumber: number | null; history: HistoryItem[] });
      setError(null);
    },
    onError: (e) => {
      setData(null);
      setError(e.message);
    },
  });

  const published = data?.history.filter((h) => h.status === "published") ?? [];
  const overallMean =
    published.length > 0
      ? Math.round(
          (published.reduce((a, h) => a + (h.grade / h.maxPoints) * 20, 0) /
            published.length) *
            100,
        ) / 100
      : null;

  return (
    <div className="pb-10">
      <section className="pb-10 pt-12 md:pt-16">
        <Link to="/" className="label-mono text-foreground/40 hover:text-foreground">
          ← Les DS
        </Link>
        <p className="label-mono mt-6 text-accent">Espace personnel</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">
          Mon évolution
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-foreground/70">
          Tes notes, tes rangs et ta moyenne sur tous les DS — visible par toi
          seul·e grâce à ton code personnel. Aucun nom n'apparaît dans les
          classements publics.
        </p>
      </section>

      {!data && (
        <form
          className="flex max-w-md flex-col gap-4 border-t border-foreground/15 pt-10"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!studentId || !secret.trim())
              return setError("Indique ton nom et ton code personnel.");
            query.mutate({ studentId: Number(studentId), secret: secret.trim() });
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
          <button type="submit" className="btn-accent w-fit" disabled={query.isPending}>
            {query.isPending ? "Chargement…" : "Voir mon évolution"}
          </button>
          <p className="text-[13px] italic text-foreground/45">
            Jamais déposé de note ? Ton code se crée au premier dépôt.
          </p>
        </form>
      )}

      {data && (
        <div className="border-t border-foreground/15 pt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <p className="text-lg">
              Tu es le{" "}
              <strong className="tnum text-2xl text-accent">
                n°{data.anonNumber}
              </strong>
            </p>
            {overallMean !== null && (
              <p className="text-lg">
                Ta moyenne générale :{" "}
                <strong className="tnum text-2xl text-accent">
                  {formatGrade(overallMean)}
                </strong>
                <span className="text-foreground/50">/20</span>
              </p>
            )}
            <button
              className="label-mono text-foreground/40 hover:text-foreground"
              onClick={() => {
                setData(null);
                setSecret("");
              }}
            >
              ← changer d'élève
            </button>
          </div>

          {data.history.length === 0 ? (
            <p className="mt-10 text-2xl font-semibold italic text-foreground/60">
              Aucune note déposée pour l'instant.
            </p>
          ) : (
            <>
              {data.history.length > 0 && <TrendChart items={data.history} />}
              <p className="label-mono mt-2 text-foreground/40">
                notes ramenées à /20 pour comparer les DS entre eux
              </p>

              <table className="mt-10 w-full">
                <thead>
                  <tr className="border-b-2 border-foreground text-left">
                    <th className="label-mono py-3 pr-4 font-normal text-foreground/50">DS</th>
                    <th className="label-mono py-3 pr-4 font-normal text-foreground/50">Note</th>
                    <th className="label-mono py-3 pr-4 font-normal text-foreground/50">Rang</th>
                    <th className="label-mono py-3 text-right font-normal text-foreground/50">
                      Moy. classe
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((h) => (
                    <tr key={h.examId} className="rank-row">
                      <td className="py-3 pr-4">
                        <Link
                          to={`/ds/${h.examId}`}
                          className="font-semibold underline decoration-foreground/30 underline-offset-4 hover:decoration-accent"
                        >
                          {h.title}
                        </Link>
                        <span className="label-mono ml-3 text-foreground/40">
                          {h.subject}
                        </span>
                      </td>
                      <td className="tnum py-3 pr-4 text-lg">
                        {formatGrade(h.grade)}/{h.maxPoints}
                      </td>
                      <td className="tnum py-3 pr-4 text-lg">
                        {h.rank !== null ? (
                          <>
                            <strong className="text-accent">{h.rank}</strong>
                            <span className="text-foreground/40">/{h.classCount}</span>
                          </>
                        ) : (
                          <span className="label-mono text-foreground/40">
                            {h.status === "open" ? "en cours" : "fermé"}
                          </span>
                        )}
                      </td>
                      <td className="tnum py-3 text-right text-lg text-foreground/60">
                        {h.classMean !== null
                          ? `${formatGrade(h.classMean)}/${h.maxPoints}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
