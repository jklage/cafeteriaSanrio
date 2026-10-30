-- Base de datos de Café Sanrio.

-- ========== Acceso ==========

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(150) NOT NULL UNIQUE,
    contrasena VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'cajero')),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- ========== Ventas ==========

CREATE TABLE IF NOT EXISTS categoria_producto (
    id_categoria SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS producto (
    id_producto SERIAL PRIMARY KEY,
    id_categoria INTEGER REFERENCES categoria_producto(id_categoria),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio_venta NUMERIC(10, 2) NOT NULL,
    costo NUMERIC(10, 2) NOT NULL,
    imagen TEXT,   -- foto del producto como data URL (base64); es su icono en el menú
    disponible BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS clientes_crm (
    id_cliente SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(30),
    correo VARCHAR(150)
);

-- Cada venta es también un pedido de la barra: Pendiente -> Preparando -> Entregado
CREATE TABLE IF NOT EXISTS ventas_pos (
    id_venta SERIAL PRIMARY KEY,
    fecha_venta TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cliente_nombre VARCHAR(150) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    total NUMERIC(10, 2) NOT NULL,
    metodo_pago VARCHAR(30) NOT NULL,
    estado_pedido VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
        CHECK (estado_pedido IN ('Pendiente', 'Preparando', 'Entregado'))
);

CREATE TABLE IF NOT EXISTS detalle_venta (
    id_detalle SERIAL PRIMARY KEY,
    id_venta INTEGER NOT NULL REFERENCES ventas_pos(id_venta) ON DELETE CASCADE,
    id_producto INTEGER NOT NULL REFERENCES producto(id_producto),
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10, 2) NOT NULL,
    importe NUMERIC(10, 2) NOT NULL
);

-- ========== Compras, proveedores e inventario ==========

CREATE TABLE IF NOT EXISTS proveedores (
    id_proveedor SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE,
    contacto VARCHAR(150),
    telefono VARCHAR(30),
    correo VARCHAR(150),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

-- Unidad fija; las piezas solo en enteros. Borrar un insumo solo lo marca como inactivo
CREATE TABLE IF NOT EXISTS insumos (
    id_insumo SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE,
    unidad VARCHAR(30) NOT NULL CHECK (unidad IN ('litros', 'piezas', 'kilogramos')),
    stock_actual NUMERIC(10, 2) NOT NULL,
    stock_minimo NUMERIC(10, 2) NOT NULL,
    id_proveedor INTEGER REFERENCES proveedores(id_proveedor),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT insumos_piezas_enteras CHECK (unidad <> 'piezas' OR (stock_actual = ROUND(stock_actual) AND stock_minimo = ROUND(stock_minimo)))
);

-- A qué categorías de producto se puede agregar cada insumo en el punto de venta
CREATE TABLE IF NOT EXISTS insumo_categoria (
    id_insumo INTEGER NOT NULL REFERENCES insumos(id_insumo),
    id_categoria INTEGER NOT NULL REFERENCES categoria_producto(id_categoria),
    PRIMARY KEY (id_insumo, id_categoria)
);

-- Insumos extra que se agregaron a cada línea de una venta
CREATE TABLE IF NOT EXISTS detalle_venta_insumo (
    id_detalle INTEGER NOT NULL REFERENCES detalle_venta(id_detalle) ON DELETE CASCADE,
    id_insumo INTEGER NOT NULL REFERENCES insumos(id_insumo),
    cantidad INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 5),
    PRIMARY KEY (id_detalle, id_insumo)
);

-- Cada vez que llega mercancía se guarda una entrada y se suma al stock
CREATE TABLE IF NOT EXISTS entradas_insumo (
    id_entrada SERIAL PRIMARY KEY,
    id_insumo INTEGER NOT NULL REFERENCES insumos(id_insumo),
    id_proveedor INTEGER REFERENCES proveedores(id_proveedor),
    cantidad NUMERIC(10, 2) NOT NULL CHECK (cantidad > 0),
    costo_total NUMERIC(10, 2) CHECK (costo_total >= 0),
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ========== Finanzas ==========

CREATE TABLE IF NOT EXISTS facturas (
    id_factura SERIAL PRIMARY KEY,
    tipo VARCHAR(2) NOT NULL CHECK (tipo IN ('AP', 'AR')),
    folio VARCHAR(50) NOT NULL UNIQUE,
    tercero VARCHAR(150) NOT NULL,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE NOT NULL,
    importe NUMERIC(10, 2) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente'
);

-- ========== Recursos humanos ==========

CREATE TABLE IF NOT EXISTS empleados (
    id_empleado SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    puesto VARCHAR(100) NOT NULL,
    turno VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS asistencias (
    id_asistencia SERIAL PRIMARY KEY,
    id_empleado INTEGER NOT NULL REFERENCES empleados(id_empleado) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_entrada TIME,
    hora_salida TIME,
    UNIQUE (id_empleado, fecha),
    CHECK (hora_salida IS NULL OR hora_entrada IS NOT NULL)
);

-- ========== Funciones ==========

-- Guarda un ticket con sus líneas y descuenta los insumos; si algo falla no se guarda nada
CREATE OR REPLACE FUNCTION registrar_venta_pos(
    p_cliente_nombre VARCHAR,
    p_metodo_pago VARCHAR,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_venta ventas_pos%ROWTYPE;
    v_producto RECORD;
    v_insumo RECORD;
    v_item JSONB;
    v_insumo_json JSONB;
    v_id_insumo INTEGER;
    v_cantidad INTEGER;
    v_cantidad_insumo INTEGER;
    v_total NUMERIC(10, 2) := 0;
    v_detalle_id INTEGER;
BEGIN
    IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'La venta debe incluir al menos un producto' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO ventas_pos (cliente_nombre, subtotal, total, metodo_pago)
    VALUES (COALESCE(NULLIF(p_cliente_nombre, ''), 'Cliente de mostrador'), 0, 0,
            COALESCE(NULLIF(p_metodo_pago, ''), 'Tarjeta'))
    RETURNING * INTO v_venta;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_cantidad := (v_item ->> 'cantidad')::INTEGER;
        IF v_cantidad IS NULL OR v_cantidad < 1 THEN
            RAISE EXCEPTION 'La cantidad del producto debe ser un entero positivo' USING ERRCODE = 'P0001';
        END IF;

        SELECT id_producto, nombre, precio_venta
        INTO v_producto
        FROM producto
        WHERE id_producto = (v_item ->> 'idProducto')::INTEGER
          AND disponible = TRUE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Producto no disponible' USING ERRCODE = 'P0001';
        END IF;

        v_total := v_total + v_producto.precio_venta * v_cantidad;

        INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, importe)
        VALUES (v_venta.id_venta, v_producto.id_producto, v_cantidad,
                v_producto.precio_venta, v_producto.precio_venta * v_cantidad)
        RETURNING id_detalle INTO v_detalle_id;

        v_insumo_json := COALESCE(v_item -> 'insumos', '[]'::JSONB);
        IF jsonb_typeof(v_insumo_json) <> 'array' THEN
            RAISE EXCEPTION 'Los insumos deben enviarse como una lista' USING ERRCODE = 'P0001';
        END IF;

        FOR v_insumo IN
            SELECT (value ->> 'idInsumo')::INTEGER AS id_insumo,
                   (value ->> 'cantidad')::INTEGER AS cantidad
            FROM jsonb_array_elements(v_insumo_json)
        LOOP
            v_id_insumo := v_insumo.id_insumo;
            v_cantidad_insumo := v_insumo.cantidad;
            IF v_cantidad_insumo IS NULL OR v_cantidad_insumo NOT BETWEEN 1 AND 5 THEN
                RAISE EXCEPTION 'Cada insumo debe tener una cantidad entre 1 y 5' USING ERRCODE = 'P0001';
            END IF;

            SELECT id_insumo, nombre, stock_actual
            INTO v_insumo
            FROM insumos AS i
            WHERE i.id_insumo = v_id_insumo
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Insumo no encontrado' USING ERRCODE = 'P0001';
            END IF;

            IF v_insumo.stock_actual < v_cantidad_insumo * v_cantidad THEN
                RAISE EXCEPTION 'Stock insuficiente para el insumo: %', v_insumo.nombre
                    USING ERRCODE = 'P0001';
            END IF;

            UPDATE insumos
            SET stock_actual = stock_actual - (v_cantidad_insumo * v_cantidad)
            WHERE id_insumo = v_id_insumo;

            INSERT INTO detalle_venta_insumo (id_detalle, id_insumo, cantidad)
            VALUES (v_detalle_id, v_id_insumo, v_cantidad_insumo * v_cantidad);
        END LOOP;
    END LOOP;

    UPDATE ventas_pos
    SET subtotal = v_total, total = v_total
    WHERE id_venta = v_venta.id_venta;

    RETURN jsonb_build_object(
        'id_venta', v_venta.id_venta,
        'cliente_nombre', v_venta.cliente_nombre,
        'total', v_total,
        'metodo_pago', v_venta.metodo_pago
    );
EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'Los datos de la venta no tienen un formato valido' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION listar_empleados_hoy()
RETURNS TABLE (
    id_empleado INTEGER,
    nombre VARCHAR,
    puesto VARCHAR,
    turno VARCHAR,
    hora_entrada TEXT,
    hora_salida TEXT
)
LANGUAGE SQL
STABLE
AS $$
    SELECT e.id_empleado, e.nombre, e.puesto, e.turno,
           TO_CHAR(a.hora_entrada, 'HH24:MI'),
           TO_CHAR(a.hora_salida, 'HH24:MI')
    FROM empleados e
    LEFT JOIN asistencias a
      ON a.id_empleado = e.id_empleado
     AND a.fecha = CURRENT_DATE
    ORDER BY e.nombre;
$$;

CREATE OR REPLACE FUNCTION registrar_entrada_empleado(p_id_empleado INTEGER)
RETURNS TABLE (id_empleado INTEGER, hora_entrada TIME)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO asistencias (id_empleado, fecha, hora_entrada)
    VALUES (p_id_empleado, CURRENT_DATE, CURRENT_TIME)
    RETURNING asistencias.id_empleado, asistencias.hora_entrada
    INTO registrar_entrada_empleado.id_empleado, registrar_entrada_empleado.hora_entrada;

    RETURN NEXT;
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'El empleado ya tiene asistencia registrada hoy'
            USING ERRCODE = '23505';
END;
$$;

CREATE OR REPLACE FUNCTION registrar_salida_empleado(p_id_empleado INTEGER)
RETURNS TABLE (id_empleado INTEGER, hora_salida TIME)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE asistencias
    SET hora_salida = CURRENT_TIME
    WHERE asistencias.id_empleado = p_id_empleado
      AND asistencias.fecha = CURRENT_DATE
      AND asistencias.hora_entrada IS NOT NULL
      AND asistencias.hora_salida IS NULL
    RETURNING asistencias.id_empleado, asistencias.hora_salida
    INTO registrar_salida_empleado.id_empleado, registrar_salida_empleado.hora_salida;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe una entrada abierta para este empleado hoy'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEXT;
END;
$$;

-- ========== Datos de prueba ==========

-- Cuentas de prueba. La contraseña se guarda como hash de bcrypt:
-- admin@cafesanrio.com / Admin123!   y   cajero@cafesanrio.com / Cajero123!
INSERT INTO usuarios (nombre, correo, contrasena, rol) VALUES
    ('Administrador', 'admin@cafesanrio.com', '$2a$10$UXVQ3yXqgCH0rT17MVq.VeHR4NDcwt6Q9Qi3e/yeLbsO9nbzXAX7G', 'admin'),
    ('Cajero', 'cajero@cafesanrio.com', '$2a$10$jIZMdO8XhXXGdaLUdAX4pODek/HP4UAKqTCfy7GIltL.PM2yULCi2', 'cajero')
ON CONFLICT (correo) DO NOTHING;

INSERT INTO categoria_producto (nombre) VALUES ('Bebidas'), ('Postres')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO producto (id_categoria, codigo, nombre, descripcion, precio_venta, costo)
VALUES
    ((SELECT id_categoria FROM categoria_producto WHERE nombre = 'Bebidas'), 'CAF-001', 'Cinnamoroll Cloud Latte', 'Latte de vainilla', 65.00, 22.00),
    ((SELECT id_categoria FROM categoria_producto WHERE nombre = 'Postres'), 'POS-001', 'Hello Kitty Strawberry Cake', 'Pastel de fresa', 85.00, 31.00),
    ((SELECT id_categoria FROM categoria_producto WHERE nombre = 'Postres'), 'POS-002', 'Pompompurin Flan', 'Flan de caramelo', 70.00, 24.00)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO proveedores (nombre) VALUES ('Lácteos del Valle'), ('Frutas Selectas'), ('Café Chiapas')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO insumos (nombre, unidad, stock_actual, stock_minimo, id_proveedor)
VALUES
    ('Leche entera', 'litros', 3, 8, (SELECT id_proveedor FROM proveedores WHERE nombre = 'Lácteos del Valle')),
    ('Fresas frescas', 'kilogramos', 1.5, 4, (SELECT id_proveedor FROM proveedores WHERE nombre = 'Frutas Selectas')),
    ('Café en grano', 'kilogramos', 12, 5, (SELECT id_proveedor FROM proveedores WHERE nombre = 'Café Chiapas'))
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO insumo_categoria (id_insumo, id_categoria)
SELECT i.id_insumo, c.id_categoria
FROM insumos i, categoria_producto c
WHERE (i.nombre IN ('Leche entera', 'Café en grano') AND c.nombre = 'Bebidas')
   OR (i.nombre = 'Fresas frescas' AND c.nombre = 'Postres')
ON CONFLICT DO NOTHING;

INSERT INTO clientes_crm (nombre, telefono, correo)
SELECT 'María González', '555-0102', 'maria.gonzalez@example.com'
WHERE NOT EXISTS (SELECT 1 FROM clientes_crm WHERE nombre = 'María González');

INSERT INTO facturas (tipo, folio, tercero, fecha_vencimiento, importe)
VALUES
    ('AP', 'FAC-PROV-001', 'Lácteos del Valle', CURRENT_DATE + 3, 3200.00),
    ('AR', 'FAC-CLI-001', 'María González', CURRENT_DATE + 10, 4850.00)
ON CONFLICT (folio) DO NOTHING;

INSERT INTO empleados (nombre, puesto, turno)
SELECT v.nombre, v.puesto, v.turno
FROM (VALUES ('Ana Lopez', 'Barista', 'Matutino'), ('Luis Hernandez', 'Barista', 'Vespertino')) AS v(nombre, puesto, turno)
WHERE NOT EXISTS (SELECT 1 FROM empleados e WHERE e.nombre = v.nombre);

-- Una venta de ejemplo, ya entregada
INSERT INTO ventas_pos (cliente_nombre, subtotal, total, metodo_pago, estado_pedido)
SELECT 'María González', 130.00, 130.00, 'Tarjeta', 'Entregado'
WHERE NOT EXISTS (SELECT 1 FROM ventas_pos);

INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, importe)
SELECT v.id_venta, p.id_producto, 2, p.precio_venta, 130.00
FROM ventas_pos v
JOIN producto p ON p.codigo = 'CAF-001'
WHERE NOT EXISTS (SELECT 1 FROM detalle_venta);
