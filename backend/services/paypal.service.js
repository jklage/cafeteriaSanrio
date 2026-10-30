const { query } = require('../config/db');
const { crearError } = require('../utils');
const ventasService = require('./ventas.service');

// Modo sandbox: pagos de prueba, no se cobra dinero real
const URL_PAYPAL = 'https://api-m.sandbox.paypal.com';

// PayPal pide un token de acceso antes de cualquier operación
const obtenerToken = async (extra = '') => {
    const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) throw crearError('Faltan PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en el archivo .env', 500);

    const credenciales = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    const respuesta = await fetch(`${URL_PAYPAL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${credenciales}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `grant_type=client_credentials${extra}`
    });

    if (!respuesta.ok) throw crearError('No se pudo conectar con PayPal. Revisa las credenciales del .env', 502);
    const datos = await respuesta.json();
    return datos.access_token;
};

// Token limitado que sí se puede mandar al navegador para iniciar el botón
const tokenNavegador = () => obtenerToken('&response_type=client_token&intent=sdk_init');

// El total se calcula con los precios de la base de datos, no con lo que manda el navegador
const calcularTotal = async (items) => {
    if (!Array.isArray(items) || items.length === 0) throw crearError('La venta debe incluir al menos un producto', 400);

    let total = 0;
    for (const item of items) {
        const cantidad = Number(item.cantidad);
        if (!Number.isInteger(cantidad) || cantidad < 1) throw crearError('La cantidad del producto debe ser un entero positivo', 400);

        const { rows } = await query(
            'SELECT precio_venta FROM producto WHERE id_producto = $1 AND disponible = TRUE;',
            [Number(item.idProducto)]
        );
        if (rows.length === 0) throw crearError('Producto no disponible', 400);
        total += Number(rows[0].precio_venta) * cantidad;
    }
    return total.toFixed(2);
};

const crearOrden = async ({ items }) => {
    const total = await calcularTotal(items);
    const token = await obtenerToken();

    const respuesta = await fetch(`${URL_PAYPAL}/v2/checkout/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [{ amount: { currency_code: 'MXN', value: total } }]
        })
    });

    const orden = await respuesta.json();
    if (!respuesta.ok) throw crearError('PayPal no pudo crear la orden', 502);
    return { id: orden.id };
};

// Cobra la orden aprobada y, si el pago se completó, guarda la venta
const capturarOrden = async ({ orderId, idCliente, items }) => {
    if (!orderId) throw crearError('Falta el número de orden de PayPal', 400);
    const total = await calcularTotal(items);
    const token = await obtenerToken();

    const respuesta = await fetch(`${URL_PAYPAL}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    const captura = await respuesta.json();
    if (!respuesta.ok || captura.status !== 'COMPLETED') throw crearError('PayPal no completó el pago', 402);

    // Se revisa que lo cobrado sea lo mismo que cuesta la venta
    const cobrado = captura.purchase_units[0].payments.captures[0].amount.value;
    if (Number(cobrado) !== Number(total)) throw crearError('El monto cobrado no coincide con el total de la venta', 400);

    return ventasService.registrarVenta({ idCliente, items, metodoPago: 'PayPal' });
};

module.exports = { tokenNavegador, crearOrden, capturarOrden };
