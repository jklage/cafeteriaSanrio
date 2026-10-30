// Controlador de acceso: recibe la petición, llama al servicio y contesta
const auth = require('../services/auth.service');
const { responder } = require('../utils');

const iniciarSesion = async (req, res) => {
    const { usuario, token } = await auth.iniciarSesion(req.body.correo, req.body.contrasena);
    res.cookie(auth.NOMBRE_COOKIE, token, auth.OPCIONES_COOKIE);
    res.json({ exito: true, mensaje: 'Sesión iniciada', datos: usuario });
};

const cerrarSesion = (req, res) => {
    res.clearCookie(auth.NOMBRE_COOKIE, { path: '/' });
    res.json({ exito: true, mensaje: 'Sesión cerrada' });
};

const sesionActual = responder((req) => auth.buscarPorId(req.usuario.id_usuario));

module.exports = { iniciarSesion, cerrarSesion, sesionActual };
