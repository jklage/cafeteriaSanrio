// Forma de los datos que regresa el backend. PostgreSQL manda los NUMERIC como texto,
// por eso en los componentes se usa Number() antes de hacer cuentas.

export type Rol = 'admin' | 'cajero';

export interface Usuario {
  id_usuario: number;
  nombre: string;
  correo: string;
  rol: Rol;
}

export interface Categoria {
  id_categoria: number;
  nombre: string;
}

export interface Producto {
  id_producto: number;
  id_categoria: number | null;
  categoria?: string | null;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precio_venta: number;
  costo: number | null;
  imagen: string | null;   // data URL de la foto; se usa como icono del producto
  disponible: boolean;
}

export interface Cliente {
  id_cliente: number;
  nombre: string;
  telefono: string | null;
  correo: string | null;
}

export interface Proveedor {
  id_proveedor: number;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  correo: string | null;
  total_insumos: number;
}

export interface Insumo {
  id_insumo: number;
  nombre: string;
  unidad: string;
  stock_actual: number;
  stock_minimo: number;
  id_proveedor: number | null;
  proveedor: string | null;
  requiere_reabasto: boolean;
  categorias: number[];   // categorías de producto a las que se puede agregar
}

// Una entrada de mercancía
export interface Entrada {
  id_entrada: number;
  fecha: string;
  cantidad: number;
  costo_total: number | null;
  insumo: string;
  unidad: string;
  proveedor: string | null;
}

export type EstadoPedido = 'Pendiente' | 'Preparando' | 'Entregado';

// Un ticket; también es el pedido que se prepara en la barra
export interface Venta {
  id_venta: number;
  fecha_venta: string;
  cliente_nombre: string;
  total: number;
  metodo_pago: string;
  estado_pedido: EstadoPedido;
  articulos: number;
  productos: string;
}

// Una línea del ticket tal como la recibe el backend
export interface ItemVenta {
  idProducto: number;
  cantidad: number;
  insumos: { idInsumo: number; cantidad: number }[];
}

// AP = por pagar a un proveedor, AR = por cobrar a un cliente
export interface Factura {
  id_factura: number;
  tipo: 'AP' | 'AR';
  folio: string;
  tercero: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  importe: number;
  estado: string;
}

export interface Empleado {
  id_empleado: number;
  nombre: string;
  puesto: string;
  turno: string;
  hora_entrada: string | null;   // null = todavía no registra entrada hoy
  hora_salida: string | null;
}

export interface ReporteVentas {
  resultados: { ingresos: number; egresos: number; utilidad: number };
  totales: { tickets: number; total: number; ticket_promedio: number };
  porDia: { dia: string; tickets: number; total: number }[];
  productos: { nombre: string; cantidad: number; importe: number }[];
  metodos: { metodo_pago: string; tickets: number; total: number }[];
}
