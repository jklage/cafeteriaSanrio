import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../api.service';
import { Empleado, Factura, Insumo } from '../modelos';

@Component({
  selector: 'app-resumen',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './resumen.component.html',
  styleUrl: './resumen.component.css'
})
export class ResumenComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly ventasHoy = signal<{ tickets: number; total: number }>({ tickets: 0, total: 0 });
  protected readonly insumos = signal<Insumo[]>([]);
  protected readonly facturas = signal<Factura[]>([]);
  protected readonly empleados = signal<Empleado[]>([]);

  // Las métricas se calculan con los datos reales de la base de datos.
  // Number() es necesario porque PostgreSQL manda los NUMERIC como texto.
  protected readonly insumosEnAlerta = computed(() =>
    this.insumos().filter(insumo => insumo.requiere_reabasto).length
  );

  protected readonly porCobrar = computed(() =>
    this.facturas()
      .filter(factura => factura.tipo === 'AR' && factura.estado === 'Pendiente')
      .reduce((suma, factura) => suma + Number(factura.importe), 0)
  );

  protected readonly empleadosPresentes = computed(() =>
    this.empleados().filter(empleado => empleado.hora_entrada !== null).length
  );

  ngOnInit(): void {
    this.api.get<{ tickets: number; total: number }>('/ventas/resumen').subscribe(datos => this.ventasHoy.set(datos));
    this.api.get<Insumo[]>('/inventario/insumos').subscribe(datos => this.insumos.set(datos));
    this.api.get<Factura[]>('/finanzas/facturas').subscribe(datos => this.facturas.set(datos));
    this.api.get<Empleado[]>('/rh/empleados').subscribe(datos => this.empleados.set(datos));
  }
}
