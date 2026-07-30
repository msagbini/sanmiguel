import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  mensaje: string;
  tipo: "info" | "exito" | "error";
}

interface ToastContextValue {
  notificar: (mensaje: string, tipo?: Toast["tipo"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const notificar = useCallback((mensaje: string, tipo: Toast["tipo"] = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, mensaje, tipo }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ notificar }}>
      {children}
      <div className="no-imprimir pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
              t.tipo === "exito"
                ? "bg-green-700 text-white"
                : t.tipo === "error"
                  ? "bg-red-700 text-white"
                  : "bg-stone-800 text-white"
            }`}
          >
            {t.mensaje}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}
