import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { ApiError } from "../api";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-orange-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-2xl font-bold text-orange-800">
            SM
          </div>
          <h1 className="text-xl font-bold text-stone-900">San Miguel</h1>
          <p className="text-sm text-stone-500">Inventario y punto de venta</p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Correo</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-600"
            />
          </div>
          {error && <p className="text-sm font-medium text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={cargando}
            className="mt-2 rounded-lg bg-orange-800 py-2.5 font-semibold text-white transition hover:bg-orange-900 disabled:opacity-60"
          >
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
