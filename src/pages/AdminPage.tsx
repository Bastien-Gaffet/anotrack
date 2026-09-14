import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import Stamp from "@/components/Stamp";

const STORAGE_KEY = "anotrack_admin_password";

/* ------------------------------ Porte admin ------------------------------ */

function Gate({ onAuth }: { onAuth: (password: string) => void }) {
  const configured = trpc.ano.adminConfigured.useQuery();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setup = trpc.ano.adminSetup.useMutation({
    onSuccess: () => onAuth(password),
    onError: (e) => setError(e.message),
  });
  const login = trpc.ano.adminLogin.useMutation({
    onSuccess: () => onAuth(password),
    onError: (e) => setError(e.message),
  });

  if (configured.isLoading)
    return <p className="label-mono py-24 text-foreground/40">Chargement…</p>;

  const isSetup = configured.data && !configured.data.configured;

  return (
    <div className="max-w-md py-20">
      <p className="label-mono text-accent">Espace admin</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">
        {isSetup ? "Crée ton mot de passe." : "Mot de passe."}
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-foreground/65">
        {isSetup
          ? "Première visite : choisis le mot de passe qui protégera la création des DS et la publication des classements. Ne le partage à personne."
          : "Cet espace permet de gérer la classe, créer les DS et publier les classements."}
      </p>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (isSetup) {
            if (password.length < 4)
              return setError("4 caractères minimum.");
            if (password !== confirm)
              return setError("Les deux mots de passe ne correspondent pas.");
            setup.mutate({ password });
          } else {
            login.mutate({ password });
          }
        }}
      >
        <input
          type="password"
          className="input-ink"
          placeholder="mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {isSetup && (
          <input
            type="password"
            className="input-ink"
            placeholder="confirme le mot de passe"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        )}
        {error && (
          <p className="border-l-2 border-accent pl-4 text-[15px] text-accent">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="btn-accent"
          disabled={login.isPending || setup.isPending}
        >
          {isSetup ? "Créer et entrer" : "Entrer"}
        </button>
      </form>
    </div>
  );
}

/* --------------------------- Détail d'un DS ------------------------------ */

function ExamAdminCard({
  password,
  exam,
}: {
  password: string;
  exam: {
    id: number;
    title: string;
    subject: string;
    maxPoints: number;
    expectedCount: number;
    submissionCount: number;
    status: "open" | "closed" | "published";
  };
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detail = trpc.ano.adminExamDetail.useQuery(
    { password, id: exam.id },
    { enabled: open },
  );

  const invalidate = () => {
    utils.ano.listExams.invalidate();
    utils.ano.getExam.invalidate({ id: exam.id });
    utils.ano.results.invalidate({ id: exam.id });
    detail.refetch();
  };

  const onErr = (e: { message: string }) => setError(e.message);
  const setStatus = trpc.ano.adminSetStatus.useMutation({
    onSuccess: invalidate,
    onError: onErr,
  });
  const del = trpc.ano.adminDeleteExam.useMutation({
    onSuccess: invalidate,
    onError: onErr,
  });
  const reset = trpc.ano.adminResetSubmission.useMutation({
    onSuccess: invalidate,
    onError: onErr,
  });
  const resetCode = trpc.ano.adminResetSecret.useMutation({
    onSuccess: invalidate,
    onError: onErr,
  });

  return (
    <div className="border-b border-foreground/15 py-6">
      <div className="flex flex-wrap items-center gap-4">
        <button
          className="label-mono w-6 text-left text-foreground/40"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "−" : "+"}
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-semibold">{exam.title}</h3>
          <p className="label-mono tnum mt-1 text-foreground/40">
            {exam.subject} · {exam.submissionCount}/{exam.expectedCount} notes ·
            /{exam.maxPoints}
          </p>
        </div>
        <Stamp status={exam.status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-3 pl-10">
        {exam.status === "open" && (
          <>
            <button
              className="btn-ink"
              onClick={() => setStatus.mutate({ password, id: exam.id, status: "closed" })}
            >
              Fermer les saisies
            </button>
            <button
              className="btn-accent"
              onClick={() => {
                if (confirm("Publier le classement maintenant ?"))
                  setStatus.mutate({ password, id: exam.id, status: "published" });
              }}
            >
              Publier le classement
            </button>
          </>
        )}
        {exam.status === "closed" && (
          <>
            <button
              className="btn-ink"
              onClick={() => setStatus.mutate({ password, id: exam.id, status: "open" })}
            >
              Rouvrir les saisies
            </button>
            <button
              className="btn-accent"
              onClick={() => setStatus.mutate({ password, id: exam.id, status: "published" })}
            >
              Publier le classement
            </button>
          </>
        )}
        {exam.status === "published" && (
          <button
            className="btn-ink"
            onClick={() => setStatus.mutate({ password, id: exam.id, status: "closed" })}
          >
            Dépublier
          </button>
        )}
        <button
          className="btn-ink !border-accent !text-accent hover:!bg-accent hover:!text-accent-foreground"
          onClick={() => {
            if (confirm(`Supprimer définitivement « ${exam.title} » et toutes ses notes ?`))
              del.mutate({ password, id: exam.id });
          }}
        >
          Supprimer
        </button>
      </div>

      {error && (
        <p className="mt-3 border-l-2 border-accent pl-4 text-[15px] text-accent">
          {error}
        </p>
      )}

      {open && detail.data && (
        <div className="mt-6 pl-10">
          <p className="label-mono mb-3 text-foreground/50">
            Qui a rendu sa note
          </p>
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 md:grid-cols-3">
            {detail.data.students.map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-[15px]">
                <span
                  className={`h-[9px] w-[9px] shrink-0 rounded-full ${
                    s.submitted ? "bg-accent" : "bg-foreground/15"
                  }`}
                />
                <span className={s.submitted ? "" : "text-foreground/45"}>
                  {s.name}
                </span>
                {s.submitted && (
                  <button
                    className="label-mono text-[9px] text-foreground/35 underline underline-offset-2 hover:text-accent"
                    title="Réinitialiser sa note (elle pourra être re-rentrée)"
                    onClick={() => {
                      if (confirm(`Réinitialiser la note de ${s.name} ? Il/elle pourra la re-rentrer.`))
                        reset.mutate({ password, examId: exam.id, studentId: s.id });
                    }}
                  >
                    reset note
                  </button>
                )}
                {s.hasCode && (
                  <button
                    className="label-mono text-[9px] text-foreground/35 underline underline-offset-2 hover:text-accent"
                    title="Réinitialiser son code personnel (il/elle en choisira un nouveau au prochain dépôt)"
                    onClick={() => {
                      if (confirm(`Réinitialiser le code personnel de ${s.name} ?`))
                        resetCode.mutate({ password, studentId: s.id });
                    }}
                  >
                    reset code
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="label-mono mt-4 text-foreground/35">
            Tu ne vois jamais qui a mis quelle note — c'est le principe.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Dashboard -------------------------------- */

function Dashboard({ password, onLogout }: { password: string; onLogout: () => void }) {
  const utils = trpc.useUtils();
  const exams = trpc.ano.listExams.useQuery(undefined, { refetchInterval: 20000 });
  const students = trpc.ano.adminStudents.useQuery({ password });

  // Classe
  const [rosterText, setRosterText] = useState("");
  const [rosterMsg, setRosterMsg] = useState<string | null>(null);
  useEffect(() => {
    if (students.data) setRosterText(students.data.map((s) => s.name).join("\n"));
  }, [students.data]);
  const setRoster = trpc.ano.adminSetRoster.useMutation({
    onSuccess: (d) => {
      setRosterMsg(`Liste enregistrée — ${d.count} élèves.`);
      utils.ano.roster.invalidate();
      students.refetch();
    },
    onError: (e) => setRosterMsg(e.message),
  });

  // Nouveau DS
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [maxPoints, setMaxPoints] = useState("20");
  const [examMsg, setExamMsg] = useState<string | null>(null);
  const createExam = trpc.ano.adminCreateExam.useMutation({
    onSuccess: () => {
      setExamMsg("DS créé — les saisies sont ouvertes.");
      setTitle("");
      setSubject("");
      setMaxPoints("20");
      utils.ano.listExams.invalidate();
    },
    onError: (e) => setExamMsg(e.message),
  });

  // Sécurité
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const changePw = trpc.ano.adminChangePassword.useMutation({
    onSuccess: () => {
      setPwMsg("Mot de passe changé.");
      localStorage.setItem(STORAGE_KEY, newPw);
      setNewPw("");
    },
    onError: (e) => setPwMsg(e.message),
  });

  return (
    <div className="py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="label-mono text-accent">Espace admin</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            Le bureau du délégué.
          </h1>
        </div>
        <button className="btn-ink" onClick={onLogout}>
          Se déconnecter
        </button>
      </div>

      {/* Nouveau DS */}
      <section className="border-t border-foreground/15 py-12">
        <p className="label-mono text-foreground/50">Nouveau DS</p>
        <form
          className="mt-6 grid max-w-2xl gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setExamMsg(null);
            const mp = parseFloat(maxPoints.replace(",", "."));
            if (!title.trim() || !subject.trim())
              return setExamMsg("Titre et matière requis.");
            if (Number.isNaN(mp) || mp <= 0)
              return setExamMsg("Barème invalide.");
            createExam.mutate({
              password,
              title: title.trim(),
              subject: subject.trim(),
              maxPoints: mp,
              expectedCount: students.data?.length ?? 1,
            });
          }}
        >
          <div>
            <label className="label-mono mb-2 block text-foreground/60">Titre</label>
            <input
              className="input-ink"
              placeholder="DS n°5 — Mécanique"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="label-mono mb-2 block text-foreground/60">Matière</label>
            <input
              className="input-ink"
              placeholder="Physique"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="label-mono mb-2 block text-foreground/60">Barème</label>
            <input
              className="input-ink tnum"
              inputMode="decimal"
              value={maxPoints}
              onChange={(e) => setMaxPoints(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-accent w-full" disabled={createExam.isPending}>
              Créer le DS
            </button>
          </div>
          {examMsg && (
            <p className="label-mono text-foreground/50 md:col-span-2">{examMsg}</p>
          )}
          <p className="text-[14px] italic text-foreground/45 md:col-span-2">
            L'effectif attendu est le nombre d'élèves de la liste de classe (
            {students.data?.length ?? 0}). Le classement se publiera
            automatiquement quand toutes les notes seront rentrées.
          </p>
        </form>
      </section>

      {/* Les DS */}
      <section className="border-t border-foreground/15 py-12">
        <p className="label-mono text-foreground/50">Tous les DS</p>
        <div className="mt-4">
          {exams.data?.length === 0 && (
            <p className="py-6 italic text-foreground/50">
              Aucun DS pour l'instant — crée le premier ci-dessus.
            </p>
          )}
          {exams.data?.map((e) => (
            <ExamAdminCard key={e.id} password={password} exam={e} />
          ))}
        </div>
      </section>

      {/* La classe */}
      <section className="border-t border-foreground/15 py-12">
        <p className="label-mono text-foreground/50">La classe</p>
        <p className="mt-3 max-w-xl text-[15px] text-foreground/60">
          Un nom par ligne. C'est cette liste que tes camarades verront pour se
          sélectionner. Les numéros anonymes sont tirés entre 1 et ce nombre.
        </p>
        <textarea
          className="input-ink mt-6 h-64 max-w-xl font-mono text-[15px] leading-7"
          style={{ fontFamily: "'Space Mono', monospace" }}
          placeholder={"Prénom Nom\nPrénom Nom\n…"}
          value={rosterText}
          onChange={(e) => setRosterText(e.target.value)}
        />
        <div className="mt-4 flex items-center gap-4">
          <button
            className="btn-ink"
            onClick={() =>
              setRoster.mutate({
                password,
                names: rosterText.split("\n"),
              })
            }
            disabled={setRoster.isPending}
          >
            Enregistrer la liste
          </button>
          {rosterMsg && (
            <span className="label-mono text-foreground/50">{rosterMsg}</span>
          )}
        </div>
      </section>

      {/* Sécurité */}
      <section className="border-t border-foreground/15 py-12">
        <p className="label-mono text-foreground/50">Sécurité</p>
        <form
          className="mt-6 flex max-w-md gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPwMsg(null);
            if (newPw.length < 4) return setPwMsg("4 caractères minimum.");
            changePw.mutate({ password, newPassword: newPw });
          }}
        >
          <input
            type="password"
            className="input-ink"
            placeholder="nouveau mot de passe"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
          <button type="submit" className="btn-ink shrink-0">
            Changer
          </button>
        </form>
        {pwMsg && <p className="label-mono mt-3 text-foreground/50">{pwMsg}</p>}
      </section>
    </div>
  );
}

/* -------------------------------- Page ----------------------------------- */

export default function AdminPage() {
  const [password, setPassword] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );

  // Vérifie que le mot de passe stocké est encore valide
  const check = trpc.ano.adminLogin.useMutation({
    onError: () => {
      localStorage.removeItem(STORAGE_KEY);
      setPassword(null);
    },
  });
  useEffect(() => {
    if (password) check.mutate({ password });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!password) {
    return (
      <Gate
        onAuth={(pw) => {
          localStorage.setItem(STORAGE_KEY, pw);
          setPassword(pw);
        }}
      />
    );
  }

  return (
    <Dashboard
      password={password}
      onLogout={() => {
        localStorage.removeItem(STORAGE_KEY);
        setPassword(null);
      }}
    />
  );
}
