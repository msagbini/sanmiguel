import type { LucideIcon } from "lucide-react";

const TONOS = {
  neutro: { icono: "bg-brand-50 text-brand-700", valor: "text-stone-800", borde: "border-stone-200 bg-white" },
  exito: { icono: "bg-green-100 text-green-700", valor: "text-green-700", borde: "border-green-200 bg-green-50" },
  alerta: { icono: "bg-red-100 text-red-700", valor: "text-red-700", borde: "border-red-200 bg-red-50" },
  dorado: { icono: "bg-gold-100 text-gold-700", valor: "text-brand-800", borde: "border-gold-300 bg-gold-100/40" },
} as const;

export function StatCard({
  etiqueta,
  valor,
  icon: Icon,
  tono = "neutro",
}: {
  etiqueta: string;
  valor: string;
  icon: LucideIcon;
  tono?: keyof typeof TONOS;
}) {
  const t = TONOS[tono];
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 shadow-sm ${t.borde}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.icono}`}>
        <Icon size={19} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-stone-500">{etiqueta}</p>
        <p className={`mt-0.5 text-xl font-bold ${t.valor}`}>{valor}</p>
      </div>
    </div>
  );
}
