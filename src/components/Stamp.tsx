type ExamStatus = "open" | "closed" | "published";

const CONFIG: Record<ExamStatus, { label: string; className: string }> = {
  open: { label: "En cours", className: "text-foreground" },
  closed: { label: "Fermé", className: "text-foreground/40" },
  published: { label: "Publié", className: "text-accent" },
};

export default function Stamp({ status }: { status: ExamStatus }) {
  const c = CONFIG[status];
  return <span className={`stamp ${c.className}`}>{c.label}</span>;
}
