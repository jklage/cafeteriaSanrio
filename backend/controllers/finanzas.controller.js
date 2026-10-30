// Controlador de finanzas y contabilidad: facturas AP/AR y reportes
const finanzas = require('../services/finanzas.service');
const { responder } = require('../utils');

const listarFacturas = responder(() => finanzas.listarFacturas());
const crearFactura = responder((req) => finanzas.crearFactura(req.body), 201, 'Factura registrada correctamente');
const pagarFactura = responder((req) => finanzas.pagarFactura(req.params.id));
const generarReporte = responder((req) => finanzas.generarReporte(req.query.desde, req.query.hasta));

module.exports = { listarFacturas, crearFactura, pagarFactura, generarReporte };
