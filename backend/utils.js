// Funciones que usan todos los servicios y rutas

// Error con el estado HTTP que debe responder el servidor (400, 404, 422...)
const crearError = (mensaje, estado) => {
    const error = new Error(mensaje);
    error.estado = estado;
    return error;
};

// Los textos vacíos se guardan como NULL
const limpiar = (texto) => (typeof texto === 'string' && texto.trim() ? texto.trim() : null);

const validarId = (id) => {
    const numero = Number(id);
    if (!Number.isInteger(numero) || numero < 1) throw crearError('El id debe ser un entero positivo', 400);
    return numero;
};

// Ejecuta el servicio y contesta { exito, mensaje, datos }.
// Uso en las rutas: responder((req) => servicio.crear(req.body), 201, 'Registro creado')
const responder = (servicio, estado = 200, mensaje) => async (req, res) => {
    const datos = await servicio(req);
    res.status(estado).json({ exito: true, mensaje: typeof mensaje === 'function' ? mensaje(datos) : mensaje, datos });
};

module.exports = { crearError, limpiar, validarId, responder };
