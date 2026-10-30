const { query } = require('../config/db');
const { crearError, validarId } = require('../utils');

const listarEmpleados = async () => {
    const { rows } = await query('SELECT * FROM listar_empleados_hoy();');
    return rows;
};

const TURNOS = ['Matutino', 'Vespertino'];

const validarEmpleado = (datos) => {
    const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
    const puesto = typeof datos.puesto === 'string' ? datos.puesto.trim() : '';
    if (nombre.length < 3) throw crearError('El nombre del empleado debe tener al menos 3 caracteres', 422);
    if (!puesto || !TURNOS.includes(datos.turno)) throw crearError('Escribe el puesto y elige el turno Matutino o Vespertino', 422);
    return [nombre, puesto, datos.turno];
};

const crearEmpleado = async (datos) => {
    const { rows } = await query(
        'INSERT INTO empleados (nombre, puesto, turno) VALUES ($1, $2, $3) RETURNING *;',
        validarEmpleado(datos)
    );
    return rows[0];
};

const actualizarEmpleado = async (id, datos) => {
    const { rows } = await query(
        'UPDATE empleados SET nombre = $1, puesto = $2, turno = $3 WHERE id_empleado = $4 RETURNING *;',
        [...validarEmpleado(datos), validarId(id)]
    );
    if (!rows[0]) throw crearError('Empleado no encontrado', 404);
    return rows[0];
};

// Sus asistencias se borran con él (ON DELETE CASCADE)
const eliminarEmpleado = async (id) => {
    const { rows } = await query('DELETE FROM empleados WHERE id_empleado = $1 RETURNING *;', [validarId(id)]);
    if (!rows[0]) throw crearError('Empleado no encontrado', 404);
    return rows[0];
};

const registrarEntrada = async (idEmpleado) => {
    const id = validarId(idEmpleado);
    const { rows } = await query('SELECT * FROM registrar_entrada_empleado($1);', [id]);
    return rows[0];
};

const registrarSalida = async (idEmpleado) => {
    const id = validarId(idEmpleado);
    const { rows } = await query('SELECT * FROM registrar_salida_empleado($1);', [id]);
    return rows[0];
};

// Si la salida se registró por error, se borra y el empleado sigue en turno con su entrada original
const deshacerSalida = async (idEmpleado) => {
    const id = validarId(idEmpleado);
    const { rows } = await query(
        `UPDATE asistencias SET hora_salida = NULL
         WHERE id_empleado = $1 AND fecha = CURRENT_DATE AND hora_salida IS NOT NULL
         RETURNING id_empleado, hora_entrada;`,
        [id]
    );
    if (!rows[0]) throw crearError('El empleado no tiene una salida registrada hoy', 404);
    return rows[0];
};

module.exports = { listarEmpleados, crearEmpleado, actualizarEmpleado, eliminarEmpleado, registrarEntrada, registrarSalida, deshacerSalida };