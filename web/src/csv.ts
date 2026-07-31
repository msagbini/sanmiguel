// Exportación simple a CSV (sin dependencias) para que Ventas, Productos y
// Reportes se puedan abrir en Excel/Sheets y compartir con el contador.
export function descargarCSV(nombreArchivo: string, filas: Record<string, unknown>[]) {
  if (filas.length === 0) return;
  const encabezados = Object.keys(filas[0]);
  const escapar = (valor: unknown) => {
    const texto = String(valor ?? "");
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const lineas = [
    encabezados.join(";"),
    ...filas.map((fila) => encabezados.map((h) => escapar(fila[h])).join(";")),
  ];
  // BOM para que Excel detecte UTF-8 y no dañe las tildes/ñ.
  const blob = new Blob(["﻿" + lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}
