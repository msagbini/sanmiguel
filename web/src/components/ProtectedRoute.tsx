import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import type { Rol } from "../types";

export function ProtectedRoute({
  children,
  rolesPermitidos,
}: {
  children: React.ReactNode;
  rolesPermitidos?: Rol[];
}) {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return <div className="flex h-screen items-center justify-center text-stone-500">Cargando...</div>;
  }
  if (!usuario) return <Navigate to="/login" replace />;
  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
