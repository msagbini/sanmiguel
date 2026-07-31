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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-950 px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(212,175,55,0.25), transparent 55%), radial-gradient(circle at 100% 100%, rgba(59,93,153,0.35), transparent 50%)",
        }}
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <svg viewBox="0 0 192 192" className="mx-auto mb-3 h-16 w-16" aria-hidden>
            <rect width="192" height="192" rx="34" fill="#101f38" />
            <path
              d="M44 22 H148 V98 C148 139 128 167 96 182 C64 167 44 139 44 98 Z"
              fill="none"
              stroke="#d4af37"
              strokeWidth="6"
            />
            <path d="M84,115 C55,108 40,88 44,58 C54,84 72,100 90,106 C89,109 86,112 84,115 Z" fill="#d4af37" />
            <path d="M108,115 C137,108 152,88 148,58 C138,84 120,100 102,106 C103,109 106,112 108,115 Z" fill="#d4af37" />
            <path d="M96,34 L89,52 L103,52 Z" fill="#d4af37" />
            <rect x="89" y="52" width="14" height="58" fill="#d4af37" />
            <rect x="68" y="110" width="56" height="9" fill="#d4af37" />
            <rect x="91" y="119" width="10" height="22" fill="#d4af37" />
            <circle cx="96" cy="147" r="7" fill="#d4af37" />
          </svg>
          <h1 className="text-lg font-bold leading-tight text-brand-900">Surtidesechables San Miguel Arcángel</h1>
          <p className="text-sm text-stone-500">Inventario, ventas y cartera</p>
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
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </div>
          {error && <p className="text-sm font-medium text-red-700">{error}</p>}
          <button type="submit" disabled={cargando} className="btn-primary mt-2 py-2.5">
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
