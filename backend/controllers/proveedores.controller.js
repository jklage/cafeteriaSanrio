// Controlador de compras y proveedores
const proveedores = require('../services/proveedores.service');
const { responder } = require('../utils');

const listarProveedores = responder(() => proveedores.listarProveedores());
const crearProveedor = responder((req) => proveedores.crearProveedor(req.body), 201, 'Proveedor registrado correctamente');
const actualizarProveedor = responder((req) => proveedores.actualizarProveedor(req.params.id, req.body), 200, 'Proveedor actualizado correctamente');
const bajaProveedor = responder((req) => proveedores.bajaProveedor(req.params.id), 200, 'Proveedor dado de baja correctamente');

module.exports = { listarProveedores, crearProveedor, actualizarProveedor, bajaProveedor };
