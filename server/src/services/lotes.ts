import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

// Si se especifica fecha de vencimiento al recibir mercancía, se crea un lote
// para poder avisar cuando esté por vencer y para poder darlo de baja en
// bloque si se daña/vence. Si no hay fecha, no hay nada que rastrear: el
// stock del producto sube igual, solo que sin este seguimiento.
export async function crearLoteSiAplica(
  tx: Tx,
  params: {
    productoId: number;
    cantidad: number;
    costoUnitario: number;
    fechaVencimiento?: Date | null;
    motivo?: string;
  }
) {
  if (!params.fechaVencimiento) return null;
  return tx.loteInventario.create({
    data: {
      productoId: params.productoId,
      fechaVencimiento: params.fechaVencimiento,
      cantidadInicial: params.cantidad,
      cantidadDisponible: params.cantidad,
      costoUnitario: params.costoUnitario,
      motivo: params.motivo,
    },
  });
}

// Descuenta inventario respetando FEFO (First-Expired-First-Out): primero se
// consumen los lotes que vencen más pronto. Si el producto tiene stock sin
// lote asociado (nunca se le puso fecha de vencimiento), ese excedente
// simplemente no se rastrea — no es un error, solo significa que esa porción
// del inventario no tiene vencimiento conocido.
export async function consumirLotesFEFO(tx: Tx, productoId: number, cantidad: number): Promise<void> {
  const lotes = await tx.loteInventario.findMany({
    where: { productoId, activo: true, cantidadDisponible: { gt: 0 } },
  });

  lotes.sort((a, b) => {
    if (a.fechaVencimiento && b.fechaVencimiento) return a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime();
    if (a.fechaVencimiento) return -1;
    if (b.fechaVencimiento) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let restante = cantidad;
  for (const lote of lotes) {
    if (restante <= 0) break;
    const consumir = Math.min(lote.cantidadDisponible, restante);
    await tx.loteInventario.update({
      where: { id: lote.id },
      data: { cantidadDisponible: { decrement: consumir } },
    });
    restante -= consumir;
  }
}
