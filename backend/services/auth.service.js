const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { crearError } = require('../utils');

// La sesión dura un turno de trabajo
const DURACION_SESION_MS = 8 * 60 * 60 * 1000;

// Nombre y opciones de la cookie donde viaja el token.
// httpOnly impide que JavaScript del navegador pueda leerla.
const NOMBRE_COOKIE = 'cafesanrio_sesion';
const OPCIONES_COOKIE = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DURACION_SESION_MS,
    path: '/'
};

// Lo único que se manda al navegador: nunca incluye la contraseña
const usuarioPublico = (fila) => ({
    id_usuario: fila.id_usuario,
    nombre: fila.nombre,
    correo: fila.correo,
    rol: fila.rol
});

const iniciarSesion = async (correo, contrasena) => {
    if (typeof correo !== 'string' || typeof contrasena !== 'string' || !correo.trim() || !contrasena) {
        throw crearError('Escribe tu correo y tu contraseña.', 400);
    }

    const { rows } = await query(
        'SELECT id_usuario, nombre, correo, contrasena, rol FROM usuarios WHERE correo = $1 AND activo = TRUE;',
        [correo.trim().toLowerCase()]
    );
    const usuario = rows[0];

    // bcrypt compara la contraseña escrita contra el hash guardado
    const contrasenaCorrecta = usuario && await bcrypt.compare(contrasena, usuario.contrasena);
    if (!contrasenaCorrecta) {
        throw crearError('Correo o contraseña incorrectos.', 401);
    }

    // El token solo guarda el id y el rol; se firma con JWT_SECRET del archivo .env
    const token = jwt.sign(
        { id_usuario: usuario.id_usuario, rol: usuario.rol },
        process.env.JWT_SECRET,
        { expiresIn: DURACION_SESION_MS / 1000 }
    );

    return { usuario: usuarioPublico(usuario), token };
};

// Regresa { id_usuario, rol } si el token es válido, o null si es falso o ya expiró
const leerToken = (token) => {
    if (!token) return null;
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
};

const buscarPorId = async (idUsuario) => {
    const { rows } = await query(
        'SELECT id_usuario, nombre, correo, rol FROM usuarios WHERE id_usuario = $1 AND activo = TRUE;',
        [idUsuario]
    );
    if (!rows[0]) {
        throw crearError('Tu sesión ya no es válida. Inicia sesión de nuevo.', 401);
    }
    return usuarioPublico(rows[0]);
};

module.exports = { NOMBRE_COOKIE, OPCIONES_COOKIE, iniciarSesion, leerToken, buscarPorId };
