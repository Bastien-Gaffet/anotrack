import { z } from "zod";
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { eq, and, asc, count, sql } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { students, exams, submissions, settings } from "@db/schema";

/* ------------------------- bootstrap du schéma --------------------------- */
// Idempotent : crée les tables si elles n'existent pas encore (une seule
// fois par processus). N'écrase jamais de données existantes.
let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getDb();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS students (
          id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
          name varchar(120) NOT NULL,
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY students_name_unique (name)
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS exams (
          id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
          title varchar(200) NOT NULL,
          subject varchar(120) NOT NULL,
          max_points decimal(5,2) NOT NULL,
          expected_count int NOT NULL,
          status enum('open','closed','published') NOT NULL DEFAULT 'open',
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          published_at timestamp NULL
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS submissions (
          id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
          exam_id bigint unsigned NOT NULL,
          student_id bigint unsigned NOT NULL,
          grade decimal(5,2) NOT NULL,
          anon_number int NOT NULL,
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_exam_student (exam_id, student_id),
          UNIQUE KEY uniq_exam_anon (exam_id, anon_number),
          CONSTRAINT submissions_exam_fk FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
          CONSTRAINT submissions_student_fk FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS settings (
          \`key\` varchar(64) NOT NULL PRIMARY KEY,
          value text NOT NULL
        )
      `);
      // Colonnes ajoutées après coup : les ajoute si les tables existaient déjà
      for (const [table, column, ddl] of [
        ["submissions", "secret_hash", "ADD COLUMN secret_hash varchar(64) NULL"],
        ["students", "secret_hash", "ADD COLUMN secret_hash varchar(64) NULL"],
        ["students", "anon_number", "ADD COLUMN anon_number int NULL, ADD UNIQUE KEY students_anon_unique (anon_number)"],
      ] as const) {
        const [colRows] = await db.execute(sql`
          SELECT COUNT(*) AS n FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ${table}
            AND COLUMN_NAME = ${column}
        `);
        const colCount = Number(
          (colRows as unknown as { n: number }[])[0]?.n ?? 0,
        );
        if (colCount === 0) {
          await db.execute(sql.raw(`ALTER TABLE ${table} ${ddl}`));
        }
      }
    })();
    // en cas d'échec, on réessaiera à la prochaine requête
    schemaReady.catch(() => {
      schemaReady = null;
    });
  }
  return schemaReady;
}

const guarded = publicQuery.use(async ({ next }) => {
  await ensureSchema();
  return next();
});

/* ---------------------------------- utils --------------------------------- */

const ADMIN_KEY = "admin_password_hash";

function hashPassword(password: string): string {
  return createHash("sha256").update(`anotrack:${password}`).digest("hex");
}

// Hash du code personnel d'un élève (salé par élève — un seul code pour
// tous les DS)
function hashSecret(studentId: number, secret: string): string {
  return createHash("sha256")
    .update(`anotrack-secret:${studentId}:${secret.trim().toLowerCase()}`)
    .digest("hex");
}

async function getAdminHash(): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, ADMIN_KEY))
    .limit(1);
  return row?.value ?? null;
}

async function assertAdmin(password: string) {
  const stored = await getAdminHash();
  if (!stored || stored !== hashPassword(password)) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Mot de passe incorrect.",
    });
  }
}

const adminInput = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ password: z.string().min(1), ...shape });

async function submissionCount(examId: number): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: count() })
    .from(submissions)
    .where(eq(submissions.examId, examId));
  return row?.n ?? 0;
}

function computeRanks(gradesDesc: { id: number; grade: number }[]) {
  // ex-aequo : même note => même rang, le rang suivant saute
  const ranks = new Map<number, number>();
  let lastGrade: number | null = null;
  let lastRank = 0;
  gradesDesc.forEach((row, i) => {
    if (lastGrade === null || row.grade < lastGrade) {
      lastRank = i + 1;
      lastGrade = row.grade;
    }
    ranks.set(row.id, lastRank);
  });
  return ranks;
}

const fmt = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------- router ----------------------------------- */

export const anoRouter = createRouter({
  /* ------------------------------ public ------------------------------ */

  roster: guarded.query(async () => {
    const db = getDb();
    return db.select().from(students).orderBy(asc(students.name));
  }),

  listExams: guarded.query(async () => {
    const db = getDb();
    const all = await db.select().from(exams).orderBy(asc(exams.createdAt));
    const withCounts = await Promise.all(
      all.map(async (e) => {
        let classMean: number | null = null;
        if (e.status === "published") {
          const rows = await db
            .select({ grade: submissions.grade })
            .from(submissions)
            .where(eq(submissions.examId, e.id));
          if (rows.length) {
            classMean = fmt(
              rows.reduce((a, r) => a + Number(r.grade), 0) / rows.length,
            );
          }
        }
        return {
          ...e,
          maxPoints: Number(e.maxPoints),
          submissionCount: await submissionCount(e.id),
          classMean,
        };
      }),
    );
    return withCounts.reverse(); // plus récent en premier
  }),

  getExam: guarded
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [exam] = await db
        .select()
        .from(exams)
        .where(eq(exams.id, input.id))
        .limit(1);
      if (!exam)
        throw new TRPCError({ code: "NOT_FOUND", message: "DS introuvable." });
      return {
        ...exam,
        maxPoints: Number(exam.maxPoints),
        submissionCount: await submissionCount(exam.id),
      };
    }),

  // Dépôt d'une note. Le code personnel est obligatoire :
  // - première note de l'élève (tout DS confondu) → il définit son code
  // - ensuite → le code est vérifié à chaque dépôt/modification
  // Renvoyer une note pour un DS déjà rempli la remplace (même code requis).
  submitGrade: guarded
    .input(
      z.object({
        examId: z.number().int().positive(),
        studentId: z.number().int().positive(),
        grade: z.number().min(0),
        secret: z
          .string()
          .min(4, "Ton code personnel doit faire au moins 4 caractères.")
          .max(64),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const [exam] = await db
        .select()
        .from(exams)
        .where(eq(exams.id, input.examId))
        .limit(1);
      if (!exam)
        throw new TRPCError({ code: "NOT_FOUND", message: "DS introuvable." });
      if (exam.status !== "open") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            exam.status === "closed"
              ? "Les saisies sont fermées pour ce DS."
              : "Le classement est déjà publié, les saisies sont closes.",
        });
      }
      const maxPoints = Number(exam.maxPoints);
      if (input.grade > maxPoints) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `La note doit être comprise entre 0 et ${maxPoints}.`,
        });
      }

      const [student] = await db
        .select()
        .from(students)
        .where(eq(students.id, input.studentId))
        .limit(1);
      if (!student)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Élève introuvable.",
        });

      // Code personnel : défini une fois, vérifié ensuite
      let firstEver = false;
      if (!student.secretHash) {
        firstEver = true;
        await db
          .update(students)
          .set({ secretHash: hashSecret(input.studentId, input.secret) })
          .where(eq(students.id, input.studentId));
      } else if (
        student.secretHash !== hashSecret(input.studentId, input.secret)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Code personnel incorrect. C'est celui que tu as choisi à ta première note (tous DS confondus). Oublié ? L'admin peut le réinitialiser.",
        });
      }

      const [existing] = await db
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.examId, input.examId),
            eq(submissions.studentId, input.studentId),
          ),
        )
        .limit(1);

      if (existing) {
        await db
          .update(submissions)
          .set({ grade: input.grade.toFixed(2) })
          .where(eq(submissions.id, existing.id));
        return {
          anonNumber: existing.anonNumber,
          updated: true,
          autoPublished: false,
          firstEver,
        };
      }

      // Numéro anonyme PERMANENT : tiré au sort une fois, valable pour tous
      // les DS. Plage 1..taille de la classe (élargie si la classe grossit).
      let anonNumber = student.anonNumber;
      if (anonNumber === null) {
        const taken = await db
          .select({ n: students.anonNumber })
          .from(students);
        const usedSet = new Set(
          taken.map((t) => t.n).filter((n): n is number => n !== null),
        );
        const [{ n: studentTotal }] = await db
          .select({ n: count() })
          .from(students);
        const poolSize = Math.max(studentTotal, usedSet.size + 1);
        const available: number[] = [];
        for (let i = 1; i <= poolSize; i++) {
          if (!usedSet.has(i)) available.push(i);
        }
        anonNumber = available[Math.floor(Math.random() * available.length)];
        await db
          .update(students)
          .set({ anonNumber })
          .where(eq(students.id, input.studentId));
      }

      await db.insert(submissions).values({
        examId: input.examId,
        studentId: input.studentId,
        grade: input.grade.toFixed(2),
        anonNumber,
      });

      // Publication automatique quand tout le monde a rentré sa note
      const n = await submissionCount(input.examId);
      let autoPublished = false;
      if (n >= exam.expectedCount) {
        await db
          .update(exams)
          .set({ status: "published", publishedAt: new Date() })
          .where(eq(exams.id, input.examId));
        autoPublished = true;
      }

      return { anonNumber, updated: false, autoPublished, firstEver };
    }),

  // Espace personnel : nom + code personnel → numéro anonyme et note pour ce DS.
  // Personne d'autre ne peut consulter un numéro qui n'est pas le sien.
  myGrade: guarded
    .input(
      z.object({
        examId: z.number().int().positive(),
        studentId: z.number().int().positive(),
        secret: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [student] = await db
        .select()
        .from(students)
        .where(eq(students.id, input.studentId))
        .limit(1);
      if (
        !student ||
        !student.secretHash ||
        student.secretHash !== hashSecret(input.studentId, input.secret)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Nom ou code personnel incorrect. (Jamais déposé de note ? Le code se crée au premier dépôt.)",
        });
      }
      const [row] = await db
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.examId, input.examId),
            eq(submissions.studentId, input.studentId),
          ),
        )
        .limit(1);
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tu n'as pas encore déposé de note pour ce DS.",
        });
      }
      return { anonNumber: row.anonNumber, grade: Number(row.grade) };
    }),

  // Mon évolution : nom + code personnel → toutes mes notes sur tous les DS.
  // Pour les DS publiés : mon rang et la moyenne de classe en plus.
  // Rien de tout cela n'est visible par les autres.
  myHistory: guarded
    .input(
      z.object({
        studentId: z.number().int().positive(),
        secret: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [student] = await db
        .select()
        .from(students)
        .where(eq(students.id, input.studentId))
        .limit(1);
      if (
        !student ||
        !student.secretHash ||
        student.secretHash !== hashSecret(input.studentId, input.secret)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Nom ou code personnel incorrect. (Jamais déposé de note ? Le code se crée au premier dépôt.)",
        });
      }

      const mine = await db
        .select({
          subId: submissions.id,
          examId: submissions.examId,
          grade: submissions.grade,
          anonNumber: submissions.anonNumber,
          title: exams.title,
          subject: exams.subject,
          maxPoints: exams.maxPoints,
          status: exams.status,
          createdAt: exams.createdAt,
          publishedAt: exams.publishedAt,
        })
        .from(submissions)
        .innerJoin(exams, eq(submissions.examId, exams.id))
        .where(eq(submissions.studentId, input.studentId));

      const history = await Promise.all(
        mine.map(async (m) => {
          let rank: number | null = null;
          let classMean: number | null = null;
          let classCount: number | null = null;
          if (m.status === "published") {
            const rows = await db
              .select()
              .from(submissions)
              .where(eq(submissions.examId, m.examId));
            const sorted = rows
              .map((r) => ({ id: r.id, grade: Number(r.grade) }))
              .sort((a, b) => b.grade - a.grade);
            const ranks = computeRanks(sorted);
            rank = ranks.get(m.subId) ?? null;
            classCount = sorted.length;
            classMean = sorted.length
              ? fmt(sorted.reduce((a, r) => a + r.grade, 0) / sorted.length)
              : null;
          }
          return {
            examId: m.examId,
            title: m.title,
            subject: m.subject,
            maxPoints: Number(m.maxPoints),
            status: m.status,
            publishedAt: m.publishedAt,
            grade: Number(m.grade),
            anonNumber: m.anonNumber,
            rank,
            classMean,
            classCount,
          };
        }),
      );

      // Ordre chronologique des DS (création), publiés ou non
      history.sort(
        (a, b) =>
          new Date(mine.find((m) => m.examId === a.examId)!.createdAt).getTime() -
          new Date(mine.find((m) => m.examId === b.examId)!.createdAt).getTime(),
      );

      return { anonNumber: student.anonNumber, history };
    }),

  // Résultats publiés : numéro, note, rang + stats. Aucun nom.
  results: guarded
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [exam] = await db
        .select()
        .from(exams)
        .where(eq(exams.id, input.id))
        .limit(1);
      if (!exam)
        throw new TRPCError({ code: "NOT_FOUND", message: "DS introuvable." });

      const submissionCountNow = await submissionCount(exam.id);
      if (exam.status !== "published") {
        return {
          published: false as const,
          status: exam.status,
          submissionCount: submissionCountNow,
          expectedCount: exam.expectedCount,
        };
      }

      const rows = await db
        .select()
        .from(submissions)
        .where(eq(submissions.examId, exam.id));

      const sorted = rows
        .map((r) => ({ id: r.id, anonNumber: r.anonNumber, grade: Number(r.grade) }))
        .sort((a, b) => b.grade - a.grade);
      const ranks = computeRanks(sorted);

      const grades = sorted.map((r) => r.grade);
      const mean = grades.length
        ? fmt(grades.reduce((a, b) => a + b, 0) / grades.length)
        : 0;
      const mid = Math.floor(grades.length / 2);
      const median = grades.length
        ? grades.length % 2 === 0
          ? fmt((grades[mid - 1] + grades[mid]) / 2)
          : grades[mid]
        : 0;

      return {
        published: true as const,
        status: exam.status,
        publishedAt: exam.publishedAt,
        rows: sorted.map((r) => ({
          anonNumber: r.anonNumber,
          grade: r.grade,
          rank: ranks.get(r.id)!,
        })),
        stats: {
          count: grades.length,
          mean,
          median,
          max: grades.length ? grades[0] : 0,
          min: grades.length ? grades[grades.length - 1] : 0,
        },
      };
    }),

  /* ------------------------------- admin ------------------------------ */

  adminConfigured: guarded.query(async () => ({
    configured: (await getAdminHash()) !== null,
  })),

  adminSetup: guarded
    .input(z.object({ password: z.string().min(4, "4 caractères minimum") }))
    .mutation(async ({ input }) => {
      if ((await getAdminHash()) !== null) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Le mot de passe admin est déjà configuré.",
        });
      }
      const db = getDb();
      await db.insert(settings).values({
        key: ADMIN_KEY,
        value: hashPassword(input.password),
      });
      return { ok: true };
    }),

  adminLogin: guarded
    .input(z.object({ password: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await assertAdmin(input.password);
      return { ok: true };
    }),

  adminChangePassword: guarded
    .input(
      adminInput({ newPassword: z.string().min(4, "4 caractères minimum") }),
    )
    .mutation(async ({ input }) => {
      await assertAdmin(input.password);
      const db = getDb();
      await db
        .update(settings)
        .set({ value: hashPassword(input.newPassword) })
        .where(eq(settings.key, ADMIN_KEY));
      return { ok: true };
    }),

  // Remplace la liste de classe (les élèves retirés perdent leurs notes)
  adminSetRoster: guarded
    .input(adminInput({ names: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      await assertAdmin(input.password);
      const db = getDb();
      const clean = [
        ...new Set(
          input.names.map((n) => n.trim()).filter((n) => n.length > 0),
        ),
      ];
      if (clean.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La liste de classe est vide.",
        });
      }
      const existing = await db.select().from(students);
      const wanted = new Set(clean.map((n) => n.toLowerCase()));
      for (const s of existing) {
        if (!wanted.has(s.name.toLowerCase())) {
          await db.delete(students).where(eq(students.id, s.id));
        }
      }
      const have = new Set(
        (await db.select().from(students)).map((s) => s.name.toLowerCase()),
      );
      for (const name of clean) {
        if (!have.has(name.toLowerCase())) {
          await db.insert(students).values({ name });
        }
      }
      return { count: clean.length };
    }),

  adminStudents: guarded
    .input(adminInput({}))
    .query(async ({ input }) => {
      await assertAdmin(input.password);
      const db = getDb();
      const all = await db.select().from(students).orderBy(asc(students.name));
      return all.map((s) => ({ ...s, hasCode: s.secretHash !== null }));
    }),

  // Réinitialise le code personnel d'un élève (code oublié) :
  // il pourra en choisir un nouveau à son prochain dépôt.
  adminResetSecret: guarded
    .input(adminInput({ studentId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await assertAdmin(input.password);
      const db = getDb();
      await db
        .update(students)
        .set({ secretHash: null })
        .where(eq(students.id, input.studentId));
      return { ok: true };
    }),

  adminCreateExam: guarded
    .input(
      adminInput({
        title: z.string().min(1, "Titre requis"),
        subject: z.string().min(1, "Matière requise"),
        maxPoints: z.number().positive(),
        expectedCount: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      await assertAdmin(input.password);
      const db = getDb();
      const [{ id }] = await db
        .insert(exams)
        .values({
          title: input.title,
          subject: input.subject,
          maxPoints: input.maxPoints.toFixed(2),
          expectedCount: input.expectedCount,
        })
        .$returningId();
      return { id };
    }),

  adminUpdateExam: guarded
    .input(
      adminInput({
        id: z.number().int().positive(),
        title: z.string().min(1).optional(),
        subject: z.string().min(1).optional(),
        maxPoints: z.number().positive().optional(),
        expectedCount: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await assertAdmin(input.password);
      const db = getDb();
      const patch: Record<string, string | number> = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.subject !== undefined) patch.subject = input.subject;
      if (input.maxPoints !== undefined)
        patch.maxPoints = input.maxPoints.toFixed(2);
      if (input.expectedCount !== undefined)
        patch.expectedCount = input.expectedCount;
      if (Object.keys(patch).length > 0) {
        await db.update(exams).set(patch).where(eq(exams.id, input.id));
      }
      return { ok: true };
    }),

  adminSetStatus: guarded
    .input(
      adminInput({
        id: z.number().int().positive(),
        status: z.enum(["open", "closed", "published"]),
      }),
    )
    .mutation(async ({ input }) => {
      await assertAdmin(input.password);
      const db = getDb();
      const [exam] = await db
        .select()
        .from(exams)
        .where(eq(exams.id, input.id))
        .limit(1);
      if (!exam)
        throw new TRPCError({ code: "NOT_FOUND", message: "DS introuvable." });
      await db
        .update(exams)
        .set({
          status: input.status,
          publishedAt:
            input.status === "published"
              ? (exam.publishedAt ?? new Date())
              : exam.publishedAt,
        })
        .where(eq(exams.id, input.id));
      return { ok: true };
    }),

  adminDeleteExam: guarded
    .input(adminInput({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await assertAdmin(input.password);
      const db = getDb();
      await db.delete(exams).where(eq(exams.id, input.id));
      return { ok: true };
    }),

  // Vue admin d'un DS : qui a rendu sa note (jamais les notes elles-mêmes)
  adminExamDetail: guarded
    .input(adminInput({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      await assertAdmin(input.password);
      const db = getDb();
      const [exam] = await db
        .select()
        .from(exams)
        .where(eq(exams.id, input.id))
        .limit(1);
      if (!exam)
        throw new TRPCError({ code: "NOT_FOUND", message: "DS introuvable." });
      const roster = await db.select().from(students).orderBy(asc(students.name));
      const subs = await db
        .select({ studentId: submissions.studentId })
        .from(submissions)
        .where(eq(submissions.examId, exam.id));
      const submittedIds = new Set(subs.map((s) => s.studentId));
      return {
        exam: { ...exam, maxPoints: Number(exam.maxPoints) },
        students: roster.map((s) => ({
          id: s.id,
          name: s.name,
          submitted: submittedIds.has(s.id),
          hasCode: s.secretHash !== null,
        })),
      };
    }),

  // Réinitialise la note d'un élève (numéro anonyme perdu, etc.)
  adminResetSubmission: guarded
    .input(
      adminInput({
        examId: z.number().int().positive(),
        studentId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      await assertAdmin(input.password);
      const db = getDb();
      await db
        .delete(submissions)
        .where(
          and(
            eq(submissions.examId, input.examId),
            eq(submissions.studentId, input.studentId),
          ),
        );
      // si le DS était publié, on repasse en "fermé" (à republier après correction)
      const [exam] = await db
        .select()
        .from(exams)
        .where(eq(exams.id, input.examId))
        .limit(1);
      if (exam?.status === "published") {
        await db
          .update(exams)
          .set({ status: "closed" })
          .where(eq(exams.id, input.examId));
      }
      return { ok: true };
    }),
});
