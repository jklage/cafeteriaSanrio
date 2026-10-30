const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { verificarConexion } = require('./config/db');
const rutas = require('./rutas');
const { noEncontrado, manejadorErrores } = require('./middlewares');

// Sin esta clave no se pueden firmar las sesiones: mejor detenerse con un aviso claro
if (!process.env.JWT_SECRET) {
    console.error('Falta JWT_SECRET en el archivo .env');
    process.exit(1);
}

const app = express();
const PORT = process.env.API_PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:4200', credentials: true }));
app.use(express.json({ limit: '3mb' }));   // permite la imagen de un producto
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());   // llena req.cookies para leer la cookie de sesión

app.get('/api/health', (req, res) => {
    res.json({ exito: true, mensaje: 'API Cafe Sanrio en linea' });
});

app.use('/api', rutas);
app.use(noEncontrado);
app.use(manejadorErrores);

const iniciar = async () => {
    await verificarConexion();
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
};

iniciar();
