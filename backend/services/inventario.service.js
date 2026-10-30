const { query, transaccion } = require('../config/db');
const { crearError, validarId } = require('../utils');

// Regresa el número si es válido; si no, lanza el error con el mensaje indicado
const numeroPositivo = (valor, mensaje, permitirCero = false) => {
    const numero = Number(valor);
    if (valor === null || valor === undefined || valor === '' || Number.isNaN(numero) ||
        numero < 0 || (!permitirCero && numero === 0)) {
        throw crearError(mensaje, 422);
    }
    return numero;
};

const idOpcional = (valor) => (valor === null || valor === undefined || valor === '' ? null : Number(valor));

const UNIDADES = ['litros', 'piezas', 'kilogramos'];

// Las piezas solo se cuentan en enteros
const revisarPiezas = (unidad, cantidad, campo) => {
    if (unidad === 'piezas' && !Number.isInteger(cantidad)) {
        throw crearError(`${campo} debe ser un número entero cuando la unidad es piezas`, 422);
    }
};

// Valida los datos del formulario de insumo (sirve para crear y para editar)
const validarInsumo = (datos) => {
    const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
    if (nombre.length < 3) throw crearError('El nombre del insumo debe tener al menos 3 caracteres', 422);
    if (!UNIDADES.includes(datos.unidad)) throw crearError('La unidad debe ser litros, piezas o kilogramos', 422);

    const stockActual = numeroPositivo(datos.stock_actual ?? 0, 'La existencia debe ser un número de 0 o más', true);
    const stockMinimo = numeroPositivo(datos.stock_minimo, 'El mínimo debe ser un número de 0 o más', true);
    revisarPiezas(datos.unidad, stockActual, 'La existencia');
    revisarPiezas(datos.unidad, stockMinimo, 'El mínimo');

    const categorias = Array.isArray(datos.categorias) ? datos.categorias.map(Number) : [];
    if (categorias.length === 0) throw crearError('Elige al menos una categoría de producto', 422);

    return { nombre, unidad: datos.unidad, stockActual, stockMinimo, idProveedor: idOpcional(datos.id_proveedor), categorias };
};

// Reemplaza las categorías en las que se ofrece el insumo
const guardarCategorias = async (cliente, idInsumo, categorias) => {
    await cliente.query('DELETE FROM insumo_categoria WHERE id_insumo = $1;', [idInsumo]);
    for (const idCategoria of categorias) {
        await cliente.query('INSERT INTO insumo_categoria (id_insumo, id_categoria) VALUES ($1, $2);', [idInsumo, idCategoria]);
    }
};

// Insumos activos con su proveedor, si están en alerta y a qué categorías se pueden agregar.
// También la usa el punto de venta para mostrar los extras
const listarInsumos = async () => {
    const { rows } = await query(`
        SELECT i.id_insumo, i.nombre, i.unidad, i.stock_actual, i.stock_minimo, i.id_proveedor,
               p.nombre AS proveedor,
               i.stock_actual < i.stock_minimo AS requiere_reabasto,
               ARRAY(SELECT ic.id_categoria FROM insumo_categoria ic WHERE ic.id_insumo = i.id_insumo) AS categorias
        FROM insumos i
        LEFT JOIN proveedores p ON p.id_proveedor = i.id_proveedor
        WHERE i.activo = TRUE
        ORDER BY requiere_reabasto DESC, i.nombre;
    `);
    return rows;
};

const crearInsumo = async (datos) => {
    const insumo = validarInsumo(datos);

    return transaccion(async (cliente) => {
        // Si el insumo se había borrado, se vuelve a activar con los datos nuevos
        const { rows } = await cliente.query(
            `INSERT INTO insumos (nombre, unidad, stock_actual, stock_minimo, id_proveedor)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (nombre) DO UPDATE
             SET unidad = $2, stock_actual = $3, stock_minimo = $4, id_proveedor = $5, activo = TRUE
             WHERE insumos.activo = FALSE
             RETURNING *;`,
            [insumo.nombre, insumo.unidad, insumo.stockActual, insumo.stockMinimo, insumo.idProveedor]
        );
        if (!rows[0]) throw crearError('Ya existe un insumo con ese nombre', 409);

        await guardarCategorias(cliente, rows[0].id_insumo, insumo.categorias);
        return rows[0];
    });
};

const actualizarInsumo = async (id, datos) => {
    const insumo = validarInsumo(datos);

    return transaccion(async (cliente) => {
        const { rows } = await cliente.query(
            `UPDATE insumos
             SET nombre = $1, unidad = $2, stock_actual = $3, stock_minimo = $4, id_proveedor = $5
             WHERE id_insumo = $6 AND activo = TRUE
             RETURNING *;`,
            [insumo.nombre, insumo.unidad, insumo.stockActual, insumo.stockMinimo, insumo.idProveedor, validarId(id)]
        );
        if (!rows[0]) throw crearError('Insumo no encontrado', 404);

        await guardarCategorias(cliente, rows[0].id_insumo, insumo.categorias);
        return rows[0];
    });
};

// Solo se oculta: las ventas y entradas anteriores lo siguen mostrando
const eliminarInsumo = async (id) => {
    const { rows } = await query(
        'UPDATE insumos SET activo = FALSE WHERE id_insumo = $1 AND activo = TRUE RETURNING id_insumo, nombre;',
        [validarId(id)]
    );
    if (!rows[0]) throw crearError('Insumo no encontrado', 404);
    return rows[0];
};

// Guarda la entrada y suma la cantidad al stock; si algo falla no se guarda ninguna de las dos
const registrarEntrada = async (datos) => {
    const idInsumo = Number(datos.id_insumo);
    if (!Number.isInteger(idInsumo) || idInsumo < 1) throw crearError('Elige el insumo que llegó', 422);

    const cantidad = numeroPositivo(datos.cantidad, 'La cantidad debe ser mayor a cero');
    const costoTotal = datos.costo_total === null || datos.costo_total === undefined || datos.costo_total === ''
        ? null
        : numeroPositivo(datos.costo_total, 'El costo debe ser un número de 0 o más', true);

    return transaccion(async (cliente) => {
        const actual = await cliente.query('SELECT unidad FROM insumos WHERE id_insumo = $1 AND activo = TRUE;', [idInsumo]);
        if (!actual.rows[0]) throw crearError('Insumo no encontrado', 404);
        revisarPiezas(actual.rows[0].unidad, cantidad, 'La cantidad');

        const insumo = await cliente.query(
            `UPDATE insumos SET stock_actual = stock_actual + $1
             WHERE id_insumo = $2
             RETURNING id_insumo, nombre, stock_actual, id_proveedor;`,
            [cantidad, idInsumo]
        );

        // Si no se indica proveedor, se usa el que tiene asignado el insumo
        const idProveedor = idOpcional(datos.id_proveedor) ?? insumo.rows[0].id_proveedor;

        const entrada = await cliente.query(
            `INSERT INTO entradas_insumo (id_insumo, id_proveedor, cantidad, costo_total)
             VALUES ($1, $2, $3, $4)
             RETURNING *;`,
            [idInsumo, idProveedor, cantidad, costoTotal]
        );
        return { ...entrada.rows[0], insumo: insumo.rows[0].nombre, stock_actual: insumo.rows[0].stock_actual };
    });
};

const listarEntradas = async () => {
    const { rows } = await query(`
        SELECT e.id_entrada, e.fecha, e.cantidad, e.costo_total,
               i.nombre AS insumo, i.unidad, p.nombre AS proveedor
        FROM entradas_insumo e
        JOIN insumos i ON i.id_insumo = e.id_insumo
        LEFT JOIN proveedores p ON p.id_proveedor = e.id_proveedor
        ORDER BY e.fecha DESC
        LIMIT 10;
    `);
    return rows;
};

module.exports = { listarInsumos, crearInsumo, actualizarInsumo, eliminarInsumo, registrarEntrada, listarEntradas };
