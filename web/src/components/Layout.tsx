import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import {
  ShoppingCart,
  Receipt,
  CreditCard,
  Package,
  BarChart3,
  Users,
  LineChart,
  Settings,
  Menu,
  LogOut,
  Truck,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { AlertBell } from "./AlertBell";
import { TurnoWidget } from "./TurnoWidget";
import type { Rol } from "../types";

const NAV: { to: string; label: string; icon: typeof ShoppingCart; roles: Rol[] }[] = [
  { to: "/", label: "Punto de venta", icon: ShoppingCart, roles: ["ADMIN", "CAJERO"] },
  { to: "/ventas", label: "Ventas", icon: Receipt, roles: ["ADMIN", "CAJERO"] },
  { to: "/cartera", label: "Cartera (fiado)", icon: CreditCard, roles: ["ADMIN", "CAJERO"] },
  { to: "/cuentas-por-pagar", label: "Cuentas por pagar", icon: Truck, roles: ["ADMIN"] },
  { to: "/productos", label: "Productos", icon: Package, roles: ["ADMIN"] },
  { to: "/inventario", label: "Inventario", icon: BarChart3, roles: ["ADMIN"] },
  { to: "/clientes", label: "Clientes", icon: Users, roles: ["ADMIN", "CAJERO"] },
  { to: "/reportes", label: "Reportes", icon: LineChart, roles: ["ADMIN"] },
  { to: "/configuracion", label: "Configuración", icon: Settings, roles: ["ADMIN"] },
];

export function Layout() {
  const { usuario, logout } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const items = NAV.filter((item) => usuario && item.roles.includes(usuario.rol));

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <header className="no-imprimir flex items-center justify-between bg-brand-900 px-4 py-3 text-white md:hidden">
        <span className="flex items-center gap-2 text-lg font-bold">
          <ShieldMark />
          San Miguel Arcángel
        </span>
        <div className="flex items-center gap-1">
          <AlertBell />
          <button onClick={() => setMenuAbierto((v) => !v)} className="rounded p-1.5 text-white hover:bg-brand-800">
            <Menu size={22} />
          </button>
        </div>
      </header>

      <nav
        className={`no-imprimir w-full shrink-0 bg-brand-900 text-brand-100 md:flex md:w-56 md:flex-col ${
          menuAbierto ? "block" : "hidden md:flex"
        }`}
      >
        <div className="hidden items-center justify-between px-5 py-5 md:flex">
          <div className="flex items-center gap-2">
            <ShieldMark />
            <div>
              <h1 className="text-lg font-bold leading-tight text-white">San Miguel Arcángel</h1>
              <p className="text-[11px] text-brand-100/70">Inventario y ventas</p>
            </div>
          </div>
          <AlertBell align="left" />
        </div>
        <TurnoWidget />
        <div className="flex flex-1 flex-col gap-1 px-3 py-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMenuAbierto(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg border-l-4 px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-gold-500 bg-brand-800 text-gold-400"
                    : "border-transparent text-brand-100/80 hover:bg-brand-800 hover:text-white"
                }`
              }
            >
              <item.icon size={18} aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-brand-800 px-4 py-3 text-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500 text-sm font-bold text-brand-950">
            {usuario?.nombre?.trim().charAt(0).toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-white">{usuario?.nombre}</p>
            <p className="text-xs text-brand-100/60">{usuario?.rol === "ADMIN" ? "Administrador" : "Cajero"}</p>
            <button onClick={logout} className="mt-1 flex items-center gap-1 text-xs font-semibold text-gold-400 hover:text-gold-300">
              <LogOut size={13} /> Cerrar sesión
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto bg-brand-50">
        <Outlet />
      </main>
    </div>
  );
}

function ShieldMark() {
  return (
    <svg viewBox="0 0 192 192" className="h-8 w-8 shrink-0" aria-hidden>
      <rect width="192" height="192" rx="34" fill="#17294a" />
      <path
        d="M44 22 H148 V98 C148 139 128 167 96 182 C64 167 44 139 44 98 Z"
        fill="none"
        stroke="#d4af37"
        strokeWidth="8"
      />
      <path d="M84,115 C55,108 40,88 44,58 C54,84 72,100 90,106 C89,109 86,112 84,115 Z" fill="#d4af37" />
      <path d="M108,115 C137,108 152,88 148,58 C138,84 120,100 102,106 C103,109 106,112 108,115 Z" fill="#d4af37" />
      <path d="M96,34 L89,52 L103,52 Z" fill="#d4af37" />
      <rect x="89" y="52" width="14" height="58" fill="#d4af37" />
      <rect x="68" y="110" width="56" height="9" fill="#d4af37" />
      <rect x="91" y="119" width="10" height="22" fill="#d4af37" />
      <circle cx="96" cy="147" r="7" fill="#d4af37" />
    </svg>
  );
}
