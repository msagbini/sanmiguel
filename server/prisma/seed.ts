import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CATEGORIAS = [
  "Desechables",
  "Icopor",
  "Porta comidas",
  "Dulces y galletas",
  "Papas y snacks",
  "Bebidas",
  "Aseo y limpieza",
  "Papelería y oficina",
  "Varios",
];

const ADMIN_EMAIL = "sagbini1807@gmail.com";
const ADMIN_PASSWORD = "SanMiguel2026";

async function main() {
  console.log("Sembrando datos iniciales...");

  await prisma.configuracion.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nombreNegocio: "San Miguel",
      direccion: "Cra 43 con Calle 8, Mercado de Barranquilla",
      ciudad: "Barranquilla",
    },
  });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.usuario.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      nombre: "Administrador",
      email: ADMIN_EMAIL,
      passwordHash,
      rol: "ADMIN",
    },
  });

  const categoriasCreadas: Record<string, number> = {};
  for (const nombre of CATEGORIAS) {
    const categoria = await prisma.categoria.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    categoriasCreadas[nombre] = categoria.id;
  }

  // Consumidor final por defecto, requerido por la normativa DIAN cuando no
  // se identifica al comprador (documento genérico 222222222222).
  await prisma.cliente.upsert({
    where: { tipoDocumento_numeroDocumento: { tipoDocumento: "CC", numeroDocumento: "222222222222" } },
    update: {},
    create: {
      tipoDocumento: "CC",
      numeroDocumento: "222222222222",
      nombre: "Consumidor Final",
      esConsumidorFinal: true,
    },
  });

  const productosEjemplo = [
    {
      codigoBarras: "7702001000012",
      nombre: "Vaso desechable 8 oz (paquete x25)",
      categoria: "Desechables",
      unidad: "PAQUETE",
      precioCosto: 3200,
      precioVenta: 4500,
      ivaTasa: 19,
      stock: 40,
      stockMinimo: 10,
    },
    {
      codigoBarras: "7702001000029",
      nombre: "Bandeja icopor N.16",
      categoria: "Icopor",
      unidad: "UNIDAD",
      precioCosto: 250,
      precioVenta: 400,
      ivaTasa: 19,
      stock: 200,
      stockMinimo: 50,
    },
    {
      codigoBarras: "7702001000036",
      nombre: "Porta comidas plástico 3 compartimientos",
      categoria: "Porta comidas",
      unidad: "UNIDAD",
      precioCosto: 900,
      precioVenta: 1500,
      ivaTasa: 19,
      stock: 60,
      stockMinimo: 15,
    },
    {
      codigoBarras: "7702001000043",
      nombre: "Bolsa de dulces surtidos x100",
      categoria: "Dulces y galletas",
      unidad: "PAQUETE",
      precioCosto: 8000,
      precioVenta: 12000,
      ivaTasa: 0,
      stock: 25,
      stockMinimo: 5,
    },
    {
      codigoBarras: "7702001000050",
      nombre: "Papas fritas 25g",
      categoria: "Papas y snacks",
      unidad: "UNIDAD",
      precioCosto: 900,
      precioVenta: 1500,
      ivaTasa: 5,
      stock: 100,
      stockMinimo: 20,
    },
    {
      codigoBarras: "7702001000067",
      nombre: "Gaseosa 400ml",
      categoria: "Bebidas",
      unidad: "UNIDAD",
      precioCosto: 1800,
      precioVenta: 2500,
      ivaTasa: 0,
      stock: 80,
      stockMinimo: 20,
    },
  ];

  for (const p of productosEjemplo) {
    await prisma.producto.upsert({
      where: { codigoBarras: p.codigoBarras },
      update: {},
      create: {
        codigoBarras: p.codigoBarras,
        nombre: p.nombre,
        categoriaId: categoriasCreadas[p.categoria],
        unidad: p.unidad,
        precioCosto: p.precioCosto,
        precioVenta: p.precioVenta,
        ivaTasa: p.ivaTasa,
        stock: p.stock,
        stockMinimo: p.stockMinimo,
      },
    });
  }

  console.log("Listo.");
  console.log(`Usuario admin: ${ADMIN_EMAIL} / contraseña temporal: ${ADMIN_PASSWORD}`);
  console.log("Cámbiala en cuanto entres a la app (Usuarios > editar).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
