// Calcula desde cuándo se considera vencida la deuda de un cliente,
// asumiendo que los abonos se aplican primero a las ventas fiadas más
// antiguas (FIFO). Se usa tanto en el estado de cuenta individual como en
// el reporte general de cartera.
export function calcularDiasVencido(
  ventasCreditoAsc: { total: number; createdAt: Date }[],
  totalAbonos: number,
  diasPlazoCredito: number
): number {
  let pool = totalAbonos;
  let ventaMasAntiguaPendiente: { createdAt: Date } | null = null;

  for (const venta of ventasCreditoAsc) {
    if (pool >= venta.total) pool -= venta.total;
    else {
      ventaMasAntiguaPendiente = venta;
      break;
    }
  }

  if (!ventaMasAntiguaPendiente) return 0;

  const vence = new Date(ventaMasAntiguaPendiente.createdAt);
  vence.setDate(vence.getDate() + diasPlazoCredito);
  return Math.max(0, Math.floor((Date.now() - vence.getTime()) / (1000 * 60 * 60 * 24)));
}
