import { PrismaClient } from "@prisma/client";

// timeout/maxWait más generosos que el default (5s/2s): con SQLite solo hay
// un escritor a la vez, así que una ráfaga de ventas casi simultáneas
// (dos cajas, un doble clic, un reintento automático) debe poder esperar su
// turno en vez de fallar de inmediato con un timeout de transacción.
export const prisma = new PrismaClient({
  transactionOptions: { timeout: 15000, maxWait: 15000 },
});

// WAL además de mejorar la concurrencia lectura/escritura, hace que un corte
// de luz a mitad de una venta no deje el archivo de la base de datos
// corrupto (algo muy real en una tienda de barrio con la energía inestable).
// busy_timeout le dice a SQLite que espere hasta 15s a que el escritor
// anterior termine antes de devolver "database is locked", en vez de fallar
// al instante.
// PRAGMA journal_mode/busy_timeout devuelven una fila (el valor aplicado), así
// que en SQLite hay que leerlos con $queryRawUnsafe; $executeRawUnsafe falla
// porque espera un conteo de filas afectadas, no un resultado.
prisma
  .$queryRawUnsafe("PRAGMA journal_mode = WAL;")
  .then(() => prisma.$queryRawUnsafe("PRAGMA busy_timeout = 15000;"))
  .catch((err) => console.error("No se pudieron aplicar los PRAGMA de SQLite:", err));
