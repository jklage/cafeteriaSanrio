// Controlador de recursos humanos: empleados y asistencia
const rh = require('../services/rh.service');
const { responder } = require('../utils');

const listarEmpleados = responder(() => rh.listarEmpleados());
const crearEmpleado = responder((req) => rh.crearEmpleado(req.body), 201, 'Empleado registrado correctamente');
const actualizarEmpleado = responder((req) => rh.actualizarEmpleado(req.params.id, req.body), 200, 'Empleado actualizado correctamente');
const eliminarEmpleado = responder((req) => rh.eliminarEmpleado(req.params.id), 200, 'Empleado eliminado correctamente');
const registrarEntrada = responder((req) => rh.registrarEntrada(req.body.id_empleado), 201, 'Entrada registrada correctamente');
const registrarSalida = responder((req) => rh.registrarSalida(req.body.id_empleado), 200, 'Salida registrada correctamente');
const deshacerSalida = responder((req) => rh.deshacerSalida(req.body.id_empleado), 200, 'Salida eliminada, el empleado sigue en turno');

module.exports = { listarEmpleados, crearEmpleado, actualizarEmpleado, eliminarEmpleado, registrarEntrada, registrarSalida, deshacerSalida };
