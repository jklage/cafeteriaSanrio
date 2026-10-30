const { query } = require('../config/db');
const { crearError, limpiar, validarId } = require('../utils');

// ---------- Productos del menú ----------

const listarProductos = async () => {
    const { rows } = await query(`
        SELECT p.id_producto, p.codigo, p.nombre, p.descripcion, p.precio_venta, p.costo,
               p.imagen, p.disponible, p.id_categoria, c.nombre AS categoria
        FROM producto p
        LEFT JOIN categoria_producto c ON c.id_categoria = p.id_categoria
        WHERE p.disponible = TRUE
        ORDER BY p.nombre;
    `);
    return rows;
};

const listarCategorias = async () => {
    const { rows } = await query('SELECT id_categoria, nombre FROM categoria_producto ORDER BY nombre;');
    return rows;
};

// La imagen llega como data URL (data:image/png;base64,...) y pesa máximo 2 MB
const validarImagen = (imagen) => {
    if (!imagen) return null;
    if (typeof imagen !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,/.test(imagen)) {
        throw crearError('La imagen debe ser PNG, JPG, WEBP o GIF', 422);
    }
    if (imagen.length > 2800000) throw crearError('La imagen no puede pesar más de 2 MB', 422);
    return imagen;
};

const validarProducto = (datos) => {
    const codigo = limpiar(datos.codigo);
    const nombre = limpiar(datos.nombre);
    const precio = Number(datos.precio_venta);
    const costo = Number(datos.costo ?? 0);

    if (!codigo) throw crearError('El codigo es obligatorio', 422);
    if (!nombre || nombre.length < 3) throw crearError('El nombre debe tener al menos 3 caracteres', 422);
    if (Number.isNaN(precio) || precio <= 0) throw crearError('El precio de venta debe ser un numero mayor a cero', 422);
    if (Number.isNaN(costo) || costo < 0) throw crearError('El costo no puede ser negativo', 422);
    if (costo > precio) throw crearError('El costo no puede ser mayor al precio de venta', 422);

    return [datos.id_categoria ?? null, codigo, nombre, limpiar(datos.descripcion), precio, costo, validarImagen(datos.imagen)];
};

// El código no se puede repetir entre productos
const revisarCodigo = async (codigo, idProducto = 0) => {
    const { rows } = await query('SELECT 1 FROM producto WHERE codigo = $1 AND id_producto <> $2;', [codigo, idProducto]);
    if (rows[0]) throw crearError('Ya existe un producto con ese codigo', 409);
};

const crearProducto = async (datos) => {
    const valores = validarProducto(datos);
    await revisarCodigo(valores[1]);
    const { rows } = await query(
        `INSERT INTO producto (id_categoria, codigo, nombre, descripcion, precio_venta, costo, imagen)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *;`,
        valores
    );
    return rows[0];
};

const actualizarProducto = async (id, datos) => {
    const idProducto = validarId(id);
    const valores = validarProducto(datos);
    await revisarCodigo(valores[1], idProducto);
    const { rows } = await query(
        `UPDATE producto
         SET id_categoria = $1, codigo = $2, nombre = $3, descripcion = $4, precio_venta = $5, costo = $6, imagen = $7
         WHERE id_producto = $8
         RETURNING *;`,
        [...valores, idProducto]
    );
    if (!rows[0]) throw crearError('Producto no encontrado', 404);
    return rows[0];
};

// Dar de baja no borra: deja de salir en el menú pero las ventas anteriores lo conservan
const bajaProducto = async (id) => {
    const { rows } = await query(
        'UPDATE producto SET disponible = FALSE WHERE id_producto = $1 AND disponible = TRUE RETURNING id_producto;',
        [validarId(id)]
    );
    if (!rows[0]) throw crearError('Producto no encontrado', 404);
    return rows[0];
};

// ---------- Clientes ----------

const listarClientes = async () => {
    const { rows } = await query(`
        SELECT id_cliente, nombre, telefono, correo
        FROM clientes_crm
        ORDER BY nombre;
    `);
    return rows;
};

const validarCliente = (datos) => {
    const nombre = limpiar(datos.nombre);
    if (!nombre || nombre.length < 3) throw crearError('El nombre del cliente debe tener al menos 3 caracteres', 422);
    return [nombre, limpiar(datos.telefono), limpiar(datos.correo)];
};

const crearCliente = async (datos) => {
    const { rows } = await query(
        'INSERT INTO clientes_crm (nombre, telefono, correo) VALUES ($1, $2, $3) RETURNING *;',
        validarCliente(datos)
    );
    return rows[0];
};

const actualizarCliente = async (id, datos) => {
    const { rows } = await query(
        'UPDATE clientes_crm SET nombre = $1, telefono = $2, correo = $3 WHERE id_cliente = $4 RETURNING *;',
        [...validarCliente(datos), validarId(id)]
    );
    if (!rows[0]) throw crearError('Cliente no encontrado', 404);
    return rows[0];
};

// Las ventas guardan el nombre del cliente como texto, así que no se pierden
const eliminarCliente = async (id) => {
    const { rows } = await query('DELETE FROM clientes_crm WHERE id_cliente = $1 RETURNING *;', [validarId(id)]);
    if (!rows[0]) throw crearError('Cliente no encontrado', 404);
    return rows[0];
};

// ---------- Ventas y pedidos ----------

// Un renglón por ticket. "productos" junta cada línea, por ejemplo: "2 x Latte (Leche x2), 1 x Flan"
const TICKETS = `
    WITH lineas AS (
        SELECT d.id_venta, d.id_detalle, d.cantidad,
               p.nombre || COALESCE(' (' || string_agg(i.nombre || ' x' || dvi.cantidad, ', ') || ')', '') AS descripcion
        FROM detalle_venta d
        JOIN producto p ON p.id_producto = d.id_producto
        LEFT JOIN detalle_venta_insumo dvi ON dvi.id_detalle = d.id_detalle
        LEFT JOIN insumos i ON i.id_insumo = dvi.id_insumo
        GROUP BY d.id_venta, d.id_detalle, d.cantidad, p.nombre
    )
    SELECT v.id_venta, v.fecha_venta, v.cliente_nombre, v.total, v.metodo_pago, v.estado_pedido,
           SUM(l.cantidad)::INTEGER AS articulos,
           string_agg(l.cantidad || ' x ' || l.descripcion, ', ' ORDER BY l.id_detalle) AS productos
    FROM ventas_pos v
    JOIN lineas l ON l.id_venta = v.id_venta
`;

const listarVentas = async () => {
    const { rows } = await query(`${TICKETS} GROUP BY v.id_venta ORDER BY v.id_venta DESC LIMIT 8;`);
    return rows;
};

// Pedidos de hoy y los que quedaron sin entregar de días anteriores
const listarPedidos = async () => {
    const { rows } = await query(`${TICKETS}
        WHERE v.fecha_venta::DATE = CURRENT_DATE OR v.estado_pedido <> 'Entregado'
        GROUP BY v.id_venta
        ORDER BY v.id_venta;
    `);
    return rows;
};

// Pendiente -> Preparando -> Entregado
const avanzarPedido = async (id) => {
    const { rows } = await query(`
        UPDATE ventas_pos
        SET estado_pedido = CASE estado_pedido WHEN 'Pendiente' THEN 'Preparando' ELSE 'Entregado' END
        WHERE id_venta = $1 AND estado_pedido <> 'Entregado'
        RETURNING id_venta, estado_pedido;
    `, [validarId(id)]);
    if (!rows[0]) throw crearError('El pedido no existe o ya fue entregado', 404);
    return rows[0];
};

// Lo vendido hoy, para el Resumen
const resumenDelDia = async () => {
    const { rows } = await query(`
        SELECT COUNT(*)::INTEGER AS tickets, COALESCE(SUM(total), 0) AS total
        FROM ventas_pos
        WHERE fecha_venta::DATE = CURRENT_DATE;
    `);
    return rows[0];
};

// items: [{ idProducto, cantidad, insumos: [{ idInsumo, cantidad }] }]
const registrarVenta = async ({ idCliente, items, metodoPago }) => {
    if (!Array.isArray(items) || items.length === 0) throw crearError('La venta debe incluir al menos un producto', 400);

    const lineas = items.map((item) => ({
        idProducto: Number(item.idProducto),
        cantidad: Number(item.cantidad),
        insumos: (item.insumos ?? []).map((insumo) => ({ idInsumo: Number(insumo.idInsumo), cantidad: Number(insumo.cantidad) }))
    }));

    // Solo se vende a clientes registrados
    const cliente = await query('SELECT nombre FROM clientes_crm WHERE id_cliente = $1;', [Number(idCliente) || 0]);
    if (!cliente.rows[0]) throw crearError('Elige un cliente registrado', 422);

    // Cada extra debe estar permitido para la categoría del producto
    for (const linea of lineas) {
        for (const insumo of linea.insumos) {
            const permitido = await query(`
                SELECT 1
                FROM producto p
                JOIN insumo_categoria ic ON ic.id_categoria = p.id_categoria
                JOIN insumos i ON i.id_insumo = ic.id_insumo
                WHERE p.id_producto = $1 AND i.id_insumo = $2 AND i.activo = TRUE;
            `, [linea.idProducto, insumo.idInsumo]);
            if (!permitido.rows[0]) throw crearError('Ese insumo no se puede agregar a este producto', 422);
        }
    }

    // La función SQL guarda el ticket, sus líneas y descuenta el inventario en una sola transacción
    const { rows } = await query(
        'SELECT registrar_venta_pos($1, $2, $3::jsonb) AS venta;',
        [cliente.rows[0].nombre, metodoPago || 'Tarjeta', JSON.stringify(lineas)]
    );
    return rows[0].venta;
};

module.exports = {
    listarProductos, listarCategorias, crearProducto, actualizarProducto, bajaProducto,
    listarClientes, crearCliente, actualizarCliente, eliminarCliente,
    listarVentas, listarPedidos, avanzarPedido, resumenDelDia, registrarVenta
};
