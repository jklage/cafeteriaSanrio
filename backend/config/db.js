const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

const verificarConexion = async () => {
    try {
        const cliente = await pool.connect();
        const resultado = await cliente.query('SELECT NOW() AS fecha');
        console.log('Conexion exitosa a PostgreSQL:', resultado.rows[0].fecha);
        cliente.release();
    } catch (error) {
        console.error('Error de conexion a PostgreSQL:', error.message);
        process.exit(1);
    }
};

const query = (texto, parametros) => pool.query(texto, parametros);

const transaccion = async (callback) => {
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        const resultado = await callback(cliente);
        await cliente.query('COMMIT');
        return resultado;
    } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
    } finally {
        cliente.release();
    }
};

module.exports = { pool, query, transaccion, verificarConexion };