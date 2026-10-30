// Controlador de ventas: menú, clientes, tickets, pedidos y factura
const ventas = require('../services/ventas.service');
const facturacion = require('../services/facturacion.service');
const { responder } = require('../utils');

// Productos del menú
const listarProductos = responder(() => ventas.listarProductos());
const listarCategorias = responder(() => ventas.listarCategorias());
const crearProducto = responder((req) => ventas.crearProducto(req.body), 201, 'Producto creado correctamente');
const actualizarProducto = responder((req) => ventas.actualizarProducto(req.params.id, req.body), 200, 'Producto actualizado correctamente');
const bajaProducto = responder((req) => ventas.bajaProducto(req.params.id), 200, 'Producto dado de baja correctamente');

// Clientes
const listarClientes = responder(() => ventas.listarClientes());
const crearCliente = responder((req) => ventas.crearCliente(req.body), 201, 'Cliente registrado correctamente');
const actualizarCliente = responder((req) => ventas.actualizarCliente(req.params.id, req.body), 200, 'Cliente actualizado correctamente');
const eliminarCliente = responder((req) => ventas.eliminarCliente(req.params.id), 200, 'Cliente eliminado correctamente');

// Tickets y pedidos
const listarVentas = responder(() => ventas.listarVentas());
const registrarVenta = responder((req) => ventas.registrarVenta(req.body), 201, 'Venta registrada correctamente');
const resumenDelDia = responder(() => ventas.resumenDelDia());
const listarPedidos = responder(() => ventas.listarPedidos());
const avanzarPedido = responder((req) => ventas.avanzarPedido(req.params.id));

// Factura XML: se descarga como archivo
const descargarXml = async (req, res) => {
    const xml = await facturacion.xmlDeVenta(req.params.id);
    res.type('application/xml').attachment(`factura-V-${req.params.id}.xml`).send(xml);
};

// Factura XML: se manda por correo (servicio externo)
const enviarFactura = responder((req) => facturacion.enviarFactura(req.params.id, req.body.correo), 200, (datos) => `Factura enviada a ${datos.correo}`);

module.exports = {
    listarProductos, listarCategorias, crearProducto, actualizarProducto, bajaProducto,
    listarClientes, crearCliente, actualizarCliente, eliminarCliente,
    listarVentas, registrarVenta, resumenDelDia, listarPedidos, avanzarPedido,
    descargarXml, enviarFactura
};
