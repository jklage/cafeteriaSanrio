import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../api.service';
import { Cliente, Factura, Proveedor } from '../modelos';

// El folio lo genera el backend
type NuevaFactura = Pick<Factura, 'tipo' | 'tercero' | 'fecha_vencimiento' | 'importe'>;

const FORMULARIO_VACIO: NuevaFactura = { tipo: 'AP', tercero: '', fecha_vencimiento: '', importe: 0 };

@Component({
  selector: 'app-finanzas',
  imports: [CurrencyPipe, DatePipe, FormsModule],
  templateUrl: './finanzas.component.html'
})
export class FinanzasComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly facturas = signal<Factura[]>([]);
  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly clientes = signal<Cliente[]>([]);
  protected busquedaTercero = '';
  protected readonly mensaje = signal('');
  protected readonly error = signal('');
  protected formulario: NuevaFactura = { ...FORMULARIO_VACIO };

  // AP = lo que la cafetería debe a proveedores
  protected readonly totalPorPagar = computed(() => this.sumarPorTipo('AP'));

  // AR = lo que los clientes le deben a la cafetería
  protected readonly totalPorCobrar = computed(() => this.sumarPorTipo('AR'));

  ngOnInit(): void {
    this.cargarFacturas();
    this.api.get<Proveedor[]>('/proveedores').subscribe(datos => this.proveedores.set(datos));
    this.api.get<Cliente[]>('/ventas/clientes').subscribe(datos => this.clientes.set(datos));
  }

  // Por pagar se busca en proveedores; por cobrar, en clientes
  protected tercerosFiltrados(): { nombre: string; detalle: string }[] {
    const lista = this.formulario.tipo === 'AP'
      ? this.proveedores().map(p => ({ nombre: p.nombre, detalle: p.contacto ?? p.telefono ?? p.correo ?? 'Sin contacto' }))
      : this.clientes().map(c => ({ nombre: c.nombre, detalle: c.telefono ?? c.correo ?? 'Sin contacto' }));
    const texto = this.busquedaTercero.trim().toLowerCase();
    return lista.filter(tercero => [tercero.nombre, tercero.detalle].some(dato => dato.toLowerCase().includes(texto)));
  }

  // Al cambiar el tipo se limpia lo que se había elegido
  protected cambiarTipo(): void {
    this.formulario.tercero = '';
    this.busquedaTercero = '';
  }

  protected guardar(): void {
    this.mensaje.set('');
    this.error.set('');

    this.api.post<Factura>('/finanzas/facturas', this.formulario).subscribe({
      next: (factura) => {
        this.mensaje.set(`Factura ${factura.folio} registrada.`);
        this.formulario = { ...FORMULARIO_VACIO };
        this.busquedaTercero = '';
        this.cargarFacturas();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  protected pagar(factura: Factura): void {
    this.mensaje.set('');
    this.error.set('');

    this.api.put(`/finanzas/facturas/${factura.id_factura}/pagar`).subscribe({
      next: () => {
        this.mensaje.set(`Factura ${factura.folio} marcada como pagada.`);
        this.cargarFacturas();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  private cargarFacturas(): void {
    this.api.get<Factura[]>('/finanzas/facturas').subscribe({
      next: (datos) => this.facturas.set(datos),
      error: () => this.error.set('No se pudieron cargar las facturas. Revisa que el servidor esté encendido.')
    });
  }

  // Solo suma las facturas que siguen pendientes
  private sumarPorTipo(tipo: string): number {
    return this.facturas()
      .filter(factura => factura.tipo === tipo && factura.estado === 'Pendiente')
      .reduce((suma, factura) => suma + Number(factura.importe), 0);
  }
}
