// Controlador de PayPal (servicio externo): el total siempre lo calcula el backend
const paypal = require('../services/paypal.service');
const { responder } = require('../utils');

const configuracion = responder(async () => ({ clientToken: await paypal.tokenNavegador() }));
const crearOrden = responder((req) => paypal.crearOrden(req.body), 201);
const capturarOrden = responder((req) => paypal.capturarOrden(req.body), 201, 'Pago con PayPal completado');

module.exports = { configuracion, crearOrden, capturarOrden };
