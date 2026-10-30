const { NOMBRE_COOKIE, leerToken } = require('./services/auth.service');

// Seguridad: deja pasar solo si la cookie de sesión trae un token válido
const requiereSesion = (req, res, next) => {
    const sesion = leerToken(req.cookies[NOMBRE_COOKIE]);
    if (!sesion) return res.status(401).json({ exito: false, mensaje: 'Inicia sesión para continuar.' });

    req.usuario = sesion;   // { id_usuario, rol }
    next();
};

// Seguridad: deja pasar solo a los roles indicados. Va después de requiereSesion
const permitirRoles = (...roles) => (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
        return res.status(403).json({ exito: false, mensaje: 'Tu usuario no tiene permiso para esta sección.' });
    }
    next();
};

const soloAdmin = permitirRoles('admin');
const todos = permitirRoles('admin', 'cajero');

const noEncontrado = (req, res) => {
    res.status(404).json({ exito: false, mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
};

// Errores de PostgreSQL que se traducen a un estado y mensaje claros
const ERRORES_PG = {
    '23505': [409, 'Ya existe un registro con ese valor unico'],
    '23503': [409, 'El registro esta relacionado con otros datos'],
    '22P02': [400, 'Tipo de dato invalido en la peticion']
};

const manejadorErrores = (error, req, res, next) => {
    console.error('[ERROR]', error.message);

    let [estado, mensaje] = ERRORES_PG[error.code] ?? [error.estado || error.status || 500, error.message || 'Error interno del servidor'];
    if (error.code === '23502') [estado, mensaje] = [422, `El campo ${error.column} es obligatorio`];
    if (error.code === 'P0001') estado = 400;   // errores lanzados por las funciones SQL

    res.status(estado).json({ exito: false, mensaje });
};

module.exports = { requiereSesion, permitirRoles, soloAdmin, todos, noEncontrado, manejadorErrores };
