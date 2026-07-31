import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { ToastProvider } from "./Toast";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { POS } from "./pages/POS";
import { Ventas } from "./pages/Ventas";
import { Productos } from "./pages/Productos";
import { Inventario } from "./pages/Inventario";
import { Clientes } from "./pages/Clientes";
import { Cartera } from "./pages/Cartera";
import { CuentasPorPagar } from "./pages/CuentasPorPagar";
import { Reportes } from "./pages/Reportes";
import { Configuracion } from "./pages/Configuracion";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<POS />} />
              <Route path="/ventas" element={<Ventas />} />
              <Route
                path="/productos"
                element={
                  <ProtectedRoute rolesPermitidos={["ADMIN"]}>
                    <Productos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventario"
                element={
                  <ProtectedRoute rolesPermitidos={["ADMIN"]}>
                    <Inventario />
                  </ProtectedRoute>
                }
              />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/cartera" element={<Cartera />} />
              <Route
                path="/cuentas-por-pagar"
                element={
                  <ProtectedRoute rolesPermitidos={["ADMIN"]}>
                    <CuentasPorPagar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reportes"
                element={
                  <ProtectedRoute rolesPermitidos={["ADMIN"]}>
                    <Reportes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracion"
                element={
                  <ProtectedRoute rolesPermitidos={["ADMIN"]}>
                    <Configuracion />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
