import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, PackageX, CalendarClock, CreditCard } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import type { Producto, ResumenCartera, ResumenVencimientos } from "../types";

export function AlertBell({ align = "right" }: { align?: "left" | "right" }) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [stockBajo, setStockBajo] = useState(0);
  const [vencimientos, setVencimientos] = useState<ResumenVencimientos>({ porVencer: 0, vencidos: 0 });
  const [carteraVencida, setCarteraVencida] = useState(0);

  async function cargar() {
    if (usuario?.rol === "ADMIN") {
      const [productos, vc] = await Promise.all([
        api.get<Producto[]>("/reportes/stock-bajo"),
        api.get<ResumenVencimientos>("/lotes/resumen"),
      ]);
      setStockBajo(productos.length);
      setVencimientos(vc);
    }
    const cartera = await api.get<ResumenCartera>("/reportes/cartera");
    setCarteraVencida(cartera.clientes.filter((c) => c.diasVencido > 0).length);
  }

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 120000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.rol]);

  const total = stockBajo + vencimientos.porVencer + vencimientos.vencidos + carteraVencida;

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="relative rounded-full p-2 text-brand-100 hover:bg-brand-800"
        aria-label="Alertas"
      >
        <Bell size={20} />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div
            className={`absolute z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-stone-200 bg-white p-2 text-stone-800 shadow-xl ${
              align === "left" ? "left-0" : "right-0"
            }`}
          >
            {total === 0 && <p className="p-3 text-sm text-stone-400">Todo tranquilo por ahora 🕊️</p>}

            {usuario?.rol === "ADMIN" && stockBajo > 0 && (
              <button
                onClick={() => {
                  navigate("/inventario");
                  setAbierto(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm hover:bg-stone-50"
              >
                <PackageX className="text-red-600" size={18} />
                <span>
                  <b>{stockBajo}</b> producto{stockBajo > 1 ? "s" : ""} con stock bajo
                </span>
              </button>
            )}

            {usuario?.rol === "ADMIN" && (vencimientos.vencidos > 0 || vencimientos.porVencer > 0) && (
              <button
                onClick={() => {
                  navigate("/inventario");
                  setAbierto(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm hover:bg-stone-50"
              >
                <CalendarClock className="text-amber-600" size={18} />
                <span>
                  {vencimientos.vencidos > 0 && (
                    <>
                      <b>{vencimientos.vencidos}</b> lote{vencimientos.vencidos > 1 ? "s" : ""} vencido{vencimientos.vencidos > 1 ? "s" : ""}
                      {vencimientos.porVencer > 0 ? " · " : ""}
                    </>
                  )}
                  {vencimientos.porVencer > 0 && (
                    <>
                      <b>{vencimientos.porVencer}</b> por vencer pronto
                    </>
                  )}
                </span>
              </button>
            )}

            {carteraVencida > 0 && (
              <button
                onClick={() => {
                  navigate("/cartera");
                  setAbierto(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm hover:bg-stone-50"
              >
                <CreditCard className="text-red-600" size={18} />
                <span>
                  <b>{carteraVencida}</b> cliente{carteraVencida > 1 ? "s" : ""} con fiado vencido
                </span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
