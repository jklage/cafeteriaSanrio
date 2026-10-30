const nodemailer = require('nodemailer');
const { query } = require('../config/db');
const { crearError, validarId } = require('../utils');

const IVA = 0.16;
const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cambia los caracteres que romperían el XML (&, <, >, comillas)
const escapar = (texto) => String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const obtenerVenta = async (idVenta) => {
    const id = validarId(idVenta);

    const venta = await query(`
        SELECT id_venta, fecha_venta, cliente_nombre, total, metodo_pago
        FROM ventas_pos
        WHERE id_venta = $1;
    `, [id]);
    if (!venta.rows[0]) throw crearError('La venta no existe', 404);

    const conceptos = await query(`
        SELECT p.codigo, p.nombre, d.cantidad, d.precio_unitario, d.importe
        FROM detalle_venta d
        JOIN producto p ON p.id_producto = d.id_producto
        WHERE d.id_venta = $1
        ORDER BY d.id_detalle;
    `, [id]);

    return { ...venta.rows[0], conceptos: conceptos.rows };
};

// Los precios del menú ya incluyen IVA, así que aquí solo se desglosa
const generarXml = (venta) => {
    const total = Number(venta.total);
    const subtotal = Math.round(total / (1 + IVA) * 100) / 100;
    const iva = Math.round((total - subtotal) * 100) / 100;
    const fecha = new Date(venta.fecha_venta).toISOString().slice(0, 19);

    const conceptos = venta.conceptos.map((c) =>
        `    <Concepto clave="${escapar(c.codigo)}" descripcion="${escapar(c.nombre)}" cantidad="${c.cantidad}" ` +
        `valorUnitario="${Number(c.precio_unitario).toFixed(2)}" importe="${Number(c.importe).toFixed(2)}"/>`
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Factura folio="V-${venta.id_venta}" fecha="${fecha}" moneda="MXN" formaPago="${escapar(venta.metodo_pago)}">
  <Emisor nombre="Café Sanrio" rfc="${escapar(process.env.RFC_EMISOR || 'XAXX010101000')}"/>
  <Receptor nombre="${escapar(venta.cliente_nombre)}"/>
  <Conceptos>
${conceptos}
  </Conceptos>
  <Impuestos tipo="IVA" tasa="${IVA.toFixed(2)}" importe="${iva.toFixed(2)}"/>
  <Totales subtotal="${subtotal.toFixed(2)}" iva="${iva.toFixed(2)}" total="${total.toFixed(2)}"/>
</Factura>
`;
};

const xmlDeVenta = async (idVenta) => generarXml(await obtenerVenta(idVenta));

// Servicio externo de correo: la cuenta SMTP está en el .env (con Gmail, una contraseña de aplicación)
const enviarCorreo = async ({ para, asunto, texto, adjuntos }) => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        throw crearError('Falta configurar SMTP_HOST, SMTP_USER y SMTP_PASS en el archivo .env', 503);
    }

    const puerto = Number(SMTP_PORT) || 465;
    const transporte = nodemailer.createTransport({
        host: SMTP_HOST,
        port: puerto,
        secure: puerto === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    return transporte.sendMail({ from: `"Café Sanrio" <${SMTP_USER}>`, to: para, subject: asunto, text: texto, attachments: adjuntos });
};

const enviarFactura = async (idVenta, correo) => {
    const destino = typeof correo === 'string' ? correo.trim() : '';
    if (!FORMATO_CORREO.test(destino)) throw crearError('Escribe un correo válido', 422);

    const venta = await obtenerVenta(idVenta);
    await enviarCorreo({
        para: destino,
        asunto: `Factura V-${venta.id_venta} de Café Sanrio`,
        texto: `Hola ${venta.cliente_nombre}, te enviamos la factura de tu compra por $${Number(venta.total).toFixed(2)} MXN. Gracias por visitarnos.`,
        adjuntos: [{ filename: `factura-V-${venta.id_venta}.xml`, content: generarXml(venta) }]
    });
    return { id_venta: venta.id_venta, correo: destino };
};

module.exports = { xmlDeVenta, enviarFactura };
