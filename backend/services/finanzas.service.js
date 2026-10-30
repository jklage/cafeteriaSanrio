const { query } = require('../config/db');
const { crearError, limpiar, validarId } = require('../utils');

// ---------- Facturas por pagar (AP) y por cobrar (AR) ----------

// Primero las pendientes, ordenadas por la que vence antes
const listarFacturas = async () => {
    const { rows } = await query(`
        SELECT id_factura, tipo, folio, tercero, fecha_emision, fecha_vencimiento,
               importe, estado
        FROM facturas
        ORDER BY estado = 'Pagada', fecha_vencimiento, folio;
    `);
    return rows;
};

// El folio se genera solo: tipo y número de factura, por ejemplo AP-0007
const crearFactura = async (datos) => {
    const tipo = datos.tipo;
    const tercero = limpiar(datos.tercero);
    const importe = Number(datos.importe);

    if (tipo !== 'AP' && tipo !== 'AR') throw crearError('El tipo debe ser AP (por pagar) o AR (por cobrar)', 422);
    if (!tercero) throw crearError('Elige el proveedor o cliente de la factura', 422);
    if (!datos.fecha_vencimiento) throw crearError('La fecha de vencimiento es obligatoria', 422);
    if (Number.isNaN(importe) || importe <= 0) throw crearError('El importe debe ser mayor a cero', 422);

    // AP es de un proveedor activo y AR de un cliente registrado
    const existe = tipo === 'AP'
        ? await query('SELECT 1 FROM proveedores WHERE nombre = $1 AND activo = TRUE;', [tercero])
        : await query('SELECT 1 FROM clientes_crm WHERE nombre = $1;', [tercero]);
    if (!existe.rows[0]) {
        throw crearError(tipo === 'AP' ? 'Elige un proveedor de la lista' : 'Elige un cliente de la lista', 422);
    }

    const siguiente = await query("SELECT nextval(pg_get_serial_sequence('facturas', 'id_factura')) AS id;");
    const id = Number(siguiente.rows[0].id);
    const folio = `${tipo}-${String(id).padStart(4, '0')}`;

    const { rows } = await query(
        `INSERT INTO facturas (id_factura, tipo, folio, tercero, fecha_vencimiento, importe)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *;`,
        [id, tipo, folio, tercero, datos.fecha_vencimiento, importe]
    );
    return rows[0];
};

// Solo una factura pendiente se puede marcar como pagada
const pagarFactura = async (id) => {
    const { rows } = await query(
        "UPDATE facturas SET estado = 'Pagada' WHERE id_factura = $1 AND estado = 'Pendiente' RETURNING *;",
        [validarId(id)]
    );
    if (!rows[0]) throw crearError('La factura no existe o ya estaba pagada', 404);
    return rows[0];
};

// ---------- Reportes y estado de resultados ----------

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Revisa el rango de fechas que llega en la URL (?desde=2026-10-01&hasta=2026-10-28)
const validarRango = (desde, hasta) => {
    if (!FORMATO_FECHA.test(desde ?? '') || !FORMATO_FECHA.test(hasta ?? '')) {
        throw crearError('Las fechas deben tener el formato AAAA-MM-DD', 400);
    }
    if (desde > hasta) throw crearError('La fecha inicial no puede ser mayor que la final', 400);
    return [desde, hasta];
};

const generarReporte = async (desde, hasta) => {
    const rango = validarRango(desde, hasta);

    const totales = await query(`
        SELECT COUNT(*)::INTEGER AS tickets,
               COALESCE(SUM(total), 0) AS total,
               COALESCE(ROUND(AVG(total), 2), 0) AS ticket_promedio
        FROM ventas_pos
        WHERE fecha_venta::DATE BETWEEN $1 AND $2;
    `, rango);

    const porDia = await query(`
        SELECT TO_CHAR(fecha_venta::DATE, 'YYYY-MM-DD') AS dia,
               COUNT(*)::INTEGER AS tickets,
               SUM(total) AS total
        FROM ventas_pos
        WHERE fecha_venta::DATE BETWEEN $1 AND $2
        GROUP BY fecha_venta::DATE
        ORDER BY fecha_venta::DATE;
    `, rango);

    // Los 5 productos que más piezas vendieron en el rango
    const productos = await query(`
        SELECT p.nombre, SUM(d.cantidad)::INTEGER AS cantidad, SUM(d.importe) AS importe
        FROM detalle_venta d
        JOIN ventas_pos v ON v.id_venta = d.id_venta
        JOIN producto p ON p.id_producto = d.id_producto
        WHERE v.fecha_venta::DATE BETWEEN $1 AND $2
        GROUP BY p.nombre
        ORDER BY cantidad DESC, importe DESC
        LIMIT 5;
    `, rango);

    const metodos = await query(`
        SELECT metodo_pago, COUNT(*)::INTEGER AS tickets, SUM(total) AS total
        FROM ventas_pos
        WHERE fecha_venta::DATE BETWEEN $1 AND $2
        GROUP BY metodo_pago
        ORDER BY total DESC;
    `, rango);

    // Estado de resultados: lo que entró por ventas menos lo que se gastó en comprar insumos
    const compras = await query(`
        SELECT COALESCE(SUM(costo_total), 0) AS total
        FROM entradas_insumo
        WHERE fecha::DATE BETWEEN $1 AND $2;
    `, rango);
    const ingresos = Number(totales.rows[0].total);
    const egresos = Number(compras.rows[0].total);

    return {
        resultados: { ingresos, egresos, utilidad: ingresos - egresos },
        totales: totales.rows[0],
        porDia: porDia.rows,
        productos: productos.rows,
        metodos: metodos.rows
    };
};

module.exports = { listarFacturas, crearFactura, pagarFactura, generarReporte };
