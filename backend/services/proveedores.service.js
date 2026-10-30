const { query } = require('../config/db');
const { crearError, limpiar, validarId } = require('../utils');

const validarDatos = (datos) => {
    const nombre = limpiar(datos.nombre);
    if (!nombre || nombre.length < 3) throw crearError('El nombre del proveedor debe tener al menos 3 caracteres', 422);
    return [nombre, limpiar(datos.contacto), limpiar(datos.telefono), limpiar(datos.correo)];
};

// Incluye cuántos insumos surte cada proveedor
const listarProveedores = async () => {
    const { rows } = await query(`
        SELECT p.id_proveedor, p.nombre, p.contacto, p.telefono, p.correo,
               COUNT(i.id_insumo)::INTEGER AS total_insumos
        FROM proveedores p
        LEFT JOIN insumos i ON i.id_proveedor = p.id_proveedor AND i.activo = TRUE
        WHERE p.activo = TRUE
        GROUP BY p.id_proveedor
        ORDER BY p.nombre;
    `);
    return rows;
};

const crearProveedor = async (datos) => {
    const { rows } = await query(
        'INSERT INTO proveedores (nombre, contacto, telefono, correo) VALUES ($1, $2, $3, $4) RETURNING *;',
        validarDatos(datos)
    );
    return rows[0];
};

const actualizarProveedor = async (id, datos) => {
    const { rows } = await query(
        `UPDATE proveedores SET nombre = $1, contacto = $2, telefono = $3, correo = $4
         WHERE id_proveedor = $5 AND activo = TRUE
         RETURNING *;`,
        [...validarDatos(datos), validarId(id)]
    );
    if (!rows[0]) throw crearError('Proveedor no encontrado', 404);
    return rows[0];
};

// Dar de baja no borra: los insumos y entradas anteriores siguen apuntando a él
const bajaProveedor = async (id) => {
    const { rows } = await query(
        'UPDATE proveedores SET activo = FALSE WHERE id_proveedor = $1 AND activo = TRUE RETURNING id_proveedor;',
        [validarId(id)]
    );
    if (!rows[0]) throw crearError('Proveedor no encontrado', 404);
    return rows[0];
};

module.exports = { listarProveedores, crearProveedor, actualizarProveedor, bajaProveedor };
