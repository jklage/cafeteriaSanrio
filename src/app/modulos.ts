import { Type } from '@angular/core';

import { Rol } from './modelos';
import { ResumenComponent } from './paginas/resumen.component';
import { VentasComponent } from './paginas/ventas.component';
import { PedidosComponent } from './paginas/pedidos.component';
import { ProductosComponent } from './paginas/productos.component';
import { InventarioComponent } from './paginas/inventario.component';
import { ProveedoresComponent } from './paginas/proveedores.component';
import { ClientesComponent } from './paginas/clientes.component';
import { FinanzasComponent } from './paginas/finanzas.component';
import { PersonalComponent } from './paginas/personal.component';
import { ReportesComponent } from './paginas/reportes.component';

export interface Modulo {
  ruta: string;
  nombre: string;
  pagina: Type<unknown>;
  roles: Rol[];      // quién puede abrirlo
  color: string;     // clase CSS que pinta el círculo del menú
  icono: string;     // personaje de public/ (.ico) o un símbolo
}

// Módulos del ERP. De esta lista salen las rutas (main.ts) y el menú (principal.component.ts).
// Para darle otro módulo al cajero, solo agrega 'cajero' en sus roles.
export const MODULOS: Modulo[] = [
  { ruta: 'resumen',     nombre: 'Resumen',          pagina: ResumenComponent,     roles: ['admin'],           color: 'circulo-rojo',     icono: 'agrettsuko.ico' },
  { ruta: 'ventas',      nombre: 'Ventas',           pagina: VentasComponent,      roles: ['admin', 'cajero'], color: 'circulo-rosa',     icono: 'hellokitty.ico' },
  { ruta: 'pedidos',     nombre: 'Pedidos',          pagina: PedidosComponent,     roles: ['admin', 'cajero'], color: 'circulo-cielo',    icono: 'pochaco.ico' },
  { ruta: 'productos',   nombre: 'Productos',        pagina: ProductosComponent,   roles: ['admin'],           color: 'circulo-rojo',     icono: 'chococat.ico' },
  { ruta: 'inventario',  nombre: 'Inventario',       pagina: InventarioComponent,  roles: ['admin'],           color: 'circulo-amarillo', icono: 'pumpumpurin.ico' },
  { ruta: 'proveedores', nombre: 'Proveedores',      pagina: ProveedoresComponent, roles: ['admin'],           color: 'circulo-amarillo', icono: 'badzmaru.ico' },
  { ruta: 'clientes',    nombre: 'Clientes',         pagina: ClientesComponent,    roles: ['admin'],           color: 'circulo-cielo',    icono: 'cinamon.ico' },
  { ruta: 'finanzas',    nombre: 'Finanzas',         pagina: FinanzasComponent,    roles: ['admin'],           color: 'circulo-morado',   icono: 'mymelody.ico' },
  { ruta: 'personal',    nombre: 'Recursos humanos', pagina: PersonalComponent,    roles: ['admin'],           color: 'circulo-verde',    icono: 'keroppi.ico' },
  { ruta: 'reportes',    nombre: 'Reportes',         pagina: ReportesComponent,    roles: ['admin'],           color: 'circulo-rosa',     icono: 'kuromi.ico' }
];
