// Controlador de inventario: insumos y entradas de mercancía
const inventario = require('../services/inventario.service');
const { responder } = require('../utils');

const listarInsumos = responder(() => inventario.listarInsumos());
const crearInsumo = responder((req) => inventario.crearInsumo(req.body), 201, 'Insumo registrado correctamente');
const actualizarInsumo = responder((req) => inventario.actualizarInsumo(req.params.id, req.body), 200, 'Insumo actualizado correctamente');
const eliminarInsumo = responder((req) => inventario.eliminarInsumo(req.params.id), 200, 'Insumo borrado correctamente');
const listarEntradas = responder(() => inventario.listarEntradas());
const registrarEntrada = responder((req) => inventario.registrarEntrada(req.body), 201, 'Entrada registrada correctamente');

module.exports = { listarInsumos, crearInsumo, actualizarInsumo, eliminarInsumo, listarEntradas, registrarEntrada };
