import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "../generated/prisma/client";


const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  // =========================
  // 1) Empresa
  // =========================
  const empresa = await prisma.empresa.upsert({
    where: { ruc: "20123456789" },
    update: {
      razon_social: "Mi Empresa S.A.C.",
      nombre_comercial: "Mi Empresa",
      direccion: "Lima, Perú",
      ubigeo: "150101",
      email: "admin@miempresa.com",
      telefono: "999999999",
      activo: true,
    },
    create: {
      ruc: "20123456789",
      razon_social: "Mi Empresa S.A.C.",
      nombre_comercial: "Mi Empresa",
      direccion: "Lima, Perú",
      ubigeo: "150101",
      email: "admin@miempresa.com",
      telefono: "999999999",
      activo: true,
    },
  });

  // =========================
  // 2) Almacén por defecto (usa @@unique([id_empresa, nombre]))
  // =========================
  const ALMACEN_NOMBRE = "Almacén Principal";

  await prisma.almacen.upsert({
    where: {
      // ✅ Prisma genera este nombre para @@unique([id_empresa, nombre]) como:
      // "id_empresa_nombre"
      // (Si lo hubieras nombrado en el schema con name:, aquí cambiaría)
      id_empresa_nombre: {
        id_empresa: empresa.id_empresa,
        nombre: ALMACEN_NOMBRE,
      },
    },
    update: {
      direccion: empresa.direccion ?? "—",
      activo: true,
    },
    create: {
      id_empresa: empresa.id_empresa,
      nombre: ALMACEN_NOMBRE,
      direccion: empresa.direccion ?? "—",
      activo: true,
    },
  });

  // =========================
  // 3) Módulos
  // =========================
  const modulos = [
    { codigo: "SEGURIDAD", nombre: "Seguridad", orden: 1, ruta_base: "/seguridad" },
    { codigo: "MAESTROS", nombre: "Maestros", orden: 2, ruta_base: "/maestros" },
    { codigo: "INVENTARIO", nombre: "Inventario", orden: 3, ruta_base: "/inventario" },
    { codigo: "COMPRAS", nombre: "Compras", orden: 4, ruta_base: "/compras" },
    { codigo: "VENTAS", nombre: "Ventas", orden: 5, ruta_base: "/ventas" },
    { codigo: "SUNAT", nombre: "SUNAT", orden: 6, ruta_base: "/sunat" },
    { codigo: "REPORTES", nombre: "Reportes", orden: 7, ruta_base: "/reportes" },
  ] as const;

  const moduloMap: Record<string, number> = {};

  for (const m of modulos) {
    const row = await prisma.modulo.upsert({
      where: { codigo: m.codigo },
      update: {
        nombre: m.nombre,
        orden: m.orden,
        ruta_base: m.ruta_base,
        activo: true,
      },
      create: {
        codigo: m.codigo,
        nombre: m.nombre,
        orden: m.orden,
        ruta_base: m.ruta_base,
        activo: true,
      },
    });

    moduloMap[m.codigo] = row.id_modulo;
  }

  // =========================
  // 4) Permisos (según tu matriz)
  // =========================
  const permisos = [
    // Seguridad
    ["USUARIO_VER", "Ver usuarios", "SEGURIDAD"],
    ["USUARIO_CREAR", "Crear usuarios", "SEGURIDAD"],
    ["USUARIO_EDITAR", "Editar usuarios", "SEGURIDAD"],
    ["USUARIO_DESACTIVAR", "Desactivar usuarios", "SEGURIDAD"],
    ["ROL_VER", "Ver roles", "SEGURIDAD"],
    ["ROL_EDITAR", "Editar roles", "SEGURIDAD"],
    ["AUDIT_VER", "Ver auditoría", "SEGURIDAD"],

    // Maestros
    ["CLIENTE_VER", "Ver clientes", "MAESTROS"],
    ["CLIENTE_CREAR", "Crear clientes", "MAESTROS"],
    ["CLIENTE_EDITAR", "Editar clientes", "MAESTROS"],
    ["PROVEEDOR_VER", "Ver proveedores", "MAESTROS"],
    ["PROVEEDOR_CREAR", "Crear proveedores", "MAESTROS"],
    ["PROVEEDOR_EDITAR", "Editar proveedores", "MAESTROS"],
    ["PRODUCTO_VER", "Ver productos", "MAESTROS"],
    ["PRODUCTO_CREAR", "Crear productos", "MAESTROS"],
    ["PRODUCTO_EDITAR", "Editar productos", "MAESTROS"],

    // Inventario
    ["STOCK_VER", "Ver stock", "INVENTARIO"],
    ["KARDEX_VER", "Ver kardex", "INVENTARIO"],
    ["STOCK_AJUSTAR", "Ajustar stock", "INVENTARIO"],
    ["MOVIMIENTO_VER", "Ver movimientos inventario", "INVENTARIO"],

    // Compras
    ["COMPRA_VER", "Ver compras", "COMPRAS"],
    ["COMPRA_CREAR", "Crear compras", "COMPRAS"],
    ["COMPRA_CONFIRMAR", "Confirmar compras", "COMPRAS"],
    ["COMPRA_ANULAR", "Anular compras", "COMPRAS"],

    // Ventas
    ["COMPROBANTE_VER", "Ver comprobantes", "VENTAS"],
    ["COMPROBANTE_CREAR", "Crear comprobantes", "VENTAS"],
    ["COMPROBANTE_CONFIRMAR", "Confirmar comprobantes", "VENTAS"],
    ["COMPROBANTE_ANULAR", "Anular comprobantes", "VENTAS"],
    ["PAGO_REGISTRAR", "Registrar pagos", "VENTAS"],

    // SUNAT
    ["SUNAT_ENVIAR", "Enviar a SUNAT", "SUNAT"],
    ["SUNAT_REENVIAR", "Reenviar a SUNAT", "SUNAT"],
    ["SUNAT_VER_CDR", "Ver CDR", "SUNAT"],

    // Reportes
    ["REPORTES_VER", "Ver reportes", "REPORTES"],
    ["REPORTES_EXPORTAR", "Exportar reportes", "REPORTES"],
  ] as const;

  const permisoIds: Record<string, number> = {};

  for (const [codigo, descripcion, mod] of permisos) {
    const id_modulo = moduloMap[mod];
    if (!id_modulo) throw new Error(`❌ Módulo no encontrado para permiso ${codigo}: ${mod}`);

    const p = await prisma.permiso.upsert({
      where: { codigo },
      update: {
        descripcion,
        id_modulo,
      },
      create: {
        codigo,
        descripcion,
        id_modulo,
      },
    });

    permisoIds[codigo] = p.id_permiso;
  }

  // =========================
  // 5) Roles
  // =========================
  const roles = [
    { nombre: "ADMIN", descripcion: "Acceso total" },
    { nombre: "VENTAS", descripcion: "Ventas + clientes + SUNAT" },
    { nombre: "ALMACEN", descripcion: "Productos + stock + compras" },
    { nombre: "CONTADOR", descripcion: "Reportes + lectura SUNAT" },
  ] as const;

  const roleRows: Record<string, number> = {};

  for (const r of roles) {
    const row = await prisma.rol.upsert({
      where: { nombre: r.nombre },
      update: { descripcion: r.descripcion, activo: true },
      create: { nombre: r.nombre, descripcion: r.descripcion, activo: true },
    });

    roleRows[r.nombre] = row.id_rol;
  }

  // =========================
  // 6) Asignación permisos por rol (idempotente)
  // =========================
  const allPermIds = Object.values(permisoIds);

  const ventasPerms = [
    "CLIENTE_VER",
    "CLIENTE_CREAR",
    "CLIENTE_EDITAR",
    "COMPROBANTE_VER",
    "COMPROBANTE_CREAR",
    "COMPROBANTE_CONFIRMAR",
    "COMPROBANTE_ANULAR",
    "PAGO_REGISTRAR",
    "SUNAT_ENVIAR",
    "SUNAT_REENVIAR",
    "SUNAT_VER_CDR",
    "REPORTES_VER",
  ].map((p) => permisoIds[p]);

  const almacenPerms = [
    "PRODUCTO_VER",
    "PRODUCTO_CREAR",
    "PRODUCTO_EDITAR",
    "STOCK_VER",
    "KARDEX_VER",
    "STOCK_AJUSTAR",
    "MOVIMIENTO_VER",
    "COMPRA_VER",
    "COMPRA_CREAR",
    "COMPRA_CONFIRMAR",
    "COMPRA_ANULAR",
  ].map((p) => permisoIds[p]);

  const contadorPerms = [
    "COMPROBANTE_VER",
    "SUNAT_VER_CDR",
    "REPORTES_VER",
    "REPORTES_EXPORTAR",
    "AUDIT_VER",
  ].map((p) => permisoIds[p]);

  const rolePerms: Record<string, number[]> = {
    ADMIN: allPermIds,
    VENTAS: ventasPerms,
    ALMACEN: almacenPerms,
    CONTADOR: contadorPerms,
  };

  for (const [rolName, permList] of Object.entries(rolePerms)) {
    const id_rol = roleRows[rolName];
    if (!id_rol) throw new Error(`❌ Rol no encontrado: ${rolName}`);

    // Limpia todo lo anterior y vuelve a insertar
    await prisma.rolPermiso.deleteMany({ where: { id_rol } });

    const cleanPerms = permList.filter((x) => typeof x === "number" && !Number.isNaN(x));

    await prisma.rolPermiso.createMany({
      data: cleanPerms.map((id_permiso) => ({ id_rol, id_permiso })),
      skipDuplicates: true,
    });
  }

  // =========================
  // 7) Usuario admin
  // =========================
  const adminPass = "Admin123*"; // cámbialo luego
  const hash = await bcrypt.hash(adminPass, 10);

  const admin = await prisma.usuario.upsert({
    where: { username: "admin" },
    update: {
      password_hash: hash,
      activo: true,
      email: "admin@miempresa.com",
      nombre: "Administrador",
      id_empresa: empresa.id_empresa,
    },
    create: {
      id_empresa: empresa.id_empresa,
      username: "admin",
      password_hash: hash,
      nombre: "Administrador",
      email: "admin@miempresa.com",
      activo: true,
    },
  });

  // =========================
  // 8) Asignar rol ADMIN al usuario admin (UsuarioRol tiene @@id([id_usuario, id_rol]))
  // =========================
  await prisma.usuarioRol.upsert({
    where: {
      id_usuario_id_rol: {
        id_usuario: admin.id_usuario,
        id_rol: roleRows.ADMIN,
      },
    },
    update: {},
    create: {
      id_usuario: admin.id_usuario,
      id_rol: roleRows.ADMIN,
    },
  });

  console.log("✅ Seed listo");
  console.log("➡️ Usuario:", "admin");
  console.log("➡️ Password:", adminPass);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
