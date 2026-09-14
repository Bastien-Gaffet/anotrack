import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  int,
  decimal,
  timestamp,
  bigint,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// La classe : simple liste de prénoms/noms (connue de tous, jamais liée
// publiquement aux notes).
export const students = mysqlTable("students", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  // Hash du code personnel de l'élève : choisi une fois à la première note,
  // réutilisé pour tous les DS (dépôt, modification, récupération du numéro).
  secretHash: varchar("secret_hash", { length: 64 }),
  // Numéro anonyme PERMANENT : tiré au sort une fois (1..taille de la classe),
  // identique sur tous les DS. C'est l'identité anonyme stable de l'élève.
  anonNumber: int("anon_number").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Un DS (devoir surveillé) : n'importe quelle matière.
// status: open (saisie en cours) -> closed (saisies fermées) -> published (classement visible)
export const exams = mysqlTable("exams", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  subject: varchar("subject", { length: 120 }).notNull(),
  maxPoints: decimal("max_points", { precision: 5, scale: 2 }).notNull(),
  expectedCount: int("expected_count").notNull(),
  status: mysqlEnum("status", ["open", "closed", "published"])
    .notNull()
    .default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"),
});

// Une note anonymisée : anonNumber est une copie du numéro permanent de
// l'élève au moment du dépôt.
export const submissions = mysqlTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    examId: bigint("exam_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    studentId: bigint("student_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    grade: decimal("grade", { precision: 5, scale: 2 }).notNull(),
    anonNumber: int("anon_number").notNull(),
    // Hash du code secret personnel choisi par l'élève au dépôt :
    // sert à retrouver son numéro anonyme sans l'aide de l'admin.
    secretHash: varchar("secret_hash", { length: 64 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    uniqExamStudent: uniqueIndex("uniq_exam_student").on(t.examId, t.studentId),
    uniqExamAnon: uniqueIndex("uniq_exam_anon").on(t.examId, t.anonNumber),
  }),
);

// Réglages internes (hash du mot de passe admin, etc.)
export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
});

export type Student = typeof students.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
