import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../AuthContext";
import type { Rol } from "../types";

const NAV: { to: string; label: string; icon: string; roles: Rol[] }[] = [
  { to: "/", label: "Punto de venta", icon: "🛒", roles: ["ADMIN", "CAJERO"] },
  { to: "/ventas", label: "Ventas", icon: "🧾", roles: ["ADMIN", "CAJERO"] },
  { to: "/cartera", label: "Cartera (fiado)", icon: "💳", roles: ["ADMIN", "CAJERO"] },
  { to: "/productos", label: "Productos", icon: "📦", roles: ["ADMIN"] },
  { to: "/inventario", label: "Inventario", icon: "📊", roles: ["ADMIN"] },
  { to: "/clientes", label: "Clientes", icon: "👤", roles: ["ADMIN", "CAJERO"] },
  { to: "/reportes", label: "Reportes", icon: "📈", roles: ["ADMIN"] },
  { to: "/configuracion", label: "Configuración", icon: "⚙️", roles: ["ADMIN"] },
];

export function Layout() {
  const { usuario, logout } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const items = NAV.filter((item) => usuario && item.roles.includes(usuario.rol));

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <header className="no-imprimir flex items-center justify-between bg-orange-900 px-4 py-3 text-white md:hidden">
        <span className="text-lg font-bold">San Miguel</span>
        <button onClick={() => setMenuAbierto((v) => !v)} className="rounded p-1 text-xl">
          ☰
        </button>
      </header>

      <nav
        className={`no-imprimir w-full shrink-0 bg-orange-900 text-orange-50 md:flex md:w-56 md:flex-col ${
          menuAbierto ? "block" : "hidden md:flex"
        }`}
      >
        <div className="hidden px-5 py-5 md:block">
          <h1 className="text-xl font-bold leading-tight">San Miguel</h1>
          <p className="text-xs text-orange-200">Inventario y ventas</p>
        </div>
        <div className="flex flex-1 flex-col gap-1 px-3 py-2">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMenuAbierto(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-orange-700 text-white" : "text-orange-100 hover:bg-orange-800"
                }`
              }
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="border-t border-orange-800 px-4 py-3 text-sm">
          <p className="font-medium">{usuario?.nombre}</p>
          <p className="text-xs text-orange-300">{usuario?.rol === "ADMIN" ? "Administrador" : "Cajero"}</p>
          <button onClick={logout} className="mt-2 text-xs font-semibold text-orange-200 underline">
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto bg-stone-100">
        <Outlet />
      </main>
    </div>
  );
}
