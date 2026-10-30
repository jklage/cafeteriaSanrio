// Todas las rutas de la API, agrupadas por módulo del ERP.
// Cada ruta pasa por la seguridad (sesión y rol) y llama a su controlador.
const express = require('express');

const { requiereSesion, soloAdmin, todos } = require('./middlewares');
const auth = require('./controllers/auth.controller');
const ventas = require('./controllers/ventas.controller');
const paypal = require('./controllers/paypal.controller');
const inventario = require('./controllers/inventario.controller');
const proveedores = require('./controllers/proveedores.controller');
const finanzas = require('./controllers/finanzas.controller');
const rh = require('./controllers/rh.controller');

const router = express.Router();

// ---------- Acceso (público) ----------
router.post('/auth/login', auth.iniciarSesion);
router.post('/auth/logout', auth.cerrarSesion);

// Desde aquí todas las rutas necesitan una sesión abierta
router.use(requiereSesion);
router.get('/auth/sesion', auth.sesionActual);

// ---------- Ventas: menú, clientes, tickets, pedidos, factura y PayPal ----------
router.get('/ventas/productos', todos, ventas.listarProductos);
router.get('/ventas/categorias', todos, ventas.listarCategorias);
router.post('/ventas/productos', soloAdmin, ventas.crearProducto);
router.put('/ventas/productos/:id', soloAdmin, ventas.actualizarProducto);
router.delete('/ventas/productos/:id', soloAdmin, ventas.bajaProducto);

router.get('/ventas/clientes', todos, ventas.listarClientes);
router.post('/ventas/clientes', soloAdmin, ventas.crearCliente);
router.put('/ventas/clientes/:id', soloAdmin, ventas.actualizarCliente);
router.delete('/ventas/clientes/:id', soloAdmin, ventas.eliminarCliente);

router.get('/ventas', todos, ventas.listarVentas);
router.post('/ventas', todos, ventas.registrarVenta);
router.get('/ventas/resumen', soloAdmin, ventas.resumenDelDia);
router.get('/ventas/pedidos', todos, ventas.listarPedidos);
router.put('/ventas/pedidos/:id/avanzar', todos, ventas.avanzarPedido);

router.get('/ventas/:id/xml', todos, ventas.descargarXml);
router.post('/ventas/:id/enviar', todos, ventas.enviarFactura);

router.get('/paypal/config', todos, paypal.configuracion);
router.post('/paypal/orden', todos, paypal.crearOrden);
router.post('/paypal/captura', todos, paypal.capturarOrden);

// ---------- Inventario ----------
router.get('/inventario/insumos', todos, inventario.listarInsumos);   // el POS los usa como extras
router.post('/inventario/insumos', soloAdmin, inventario.crearInsumo);
router.put('/inventario/insumos/:id', soloAdmin, inventario.actualizarInsumo);
router.delete('/inventario/insumos/:id', soloAdmin, inventario.eliminarInsumo);
router.get('/inventario/entradas', soloAdmin, inventario.listarEntradas);
router.post('/inventario/entradas', soloAdmin, inventario.registrarEntrada);

// ---------- Compras y proveedores ----------
router.get('/proveedores', soloAdmin, proveedores.listarProveedores);
router.post('/proveedores', soloAdmin, proveedores.crearProveedor);
router.put('/proveedores/:id', soloAdmin, proveedores.actualizarProveedor);
router.delete('/proveedores/:id', soloAdmin, proveedores.bajaProveedor);

// ---------- Finanzas y contabilidad ----------
router.get('/finanzas/facturas', soloAdmin, finanzas.listarFacturas);
router.post('/finanzas/facturas', soloAdmin, finanzas.crearFactura);
router.put('/finanzas/facturas/:id/pagar', soloAdmin, finanzas.pagarFactura);
router.get('/finanzas/reporte', soloAdmin, finanzas.generarReporte);

// ---------- Recursos humanos ----------
router.get('/rh/empleados', soloAdmin, rh.listarEmpleados);
router.post('/rh/empleados', soloAdmin, rh.crearEmpleado);
router.put('/rh/empleados/:id', soloAdmin, rh.actualizarEmpleado);
router.delete('/rh/empleados/:id', soloAdmin, rh.eliminarEmpleado);
router.post('/rh/entrada', soloAdmin, rh.registrarEntrada);
router.post('/rh/salida', soloAdmin, rh.registrarSalida);
router.post('/rh/deshacer-salida', soloAdmin, rh.deshacerSalida);

module.exports = router;
