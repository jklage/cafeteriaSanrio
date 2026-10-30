import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';

import { ApiService } from '../api.service';
import { EstadoPedido, Venta } from '../modelos';

// Cada columna del tablero: su estado, el texto del botón para avanzar y el color
interface ColumnaPedidos {
  estado: EstadoPedido;
  accion: string;
  color: string;
}

@Component({
  selector: 'app-pedidos',
  imports: [DatePipe],
  templateUrl: './pedidos.component.html',
  styleUrl: './pedidos.component.css'
})
export class PedidosComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);

  protected readonly pedidos = signal<Venta[]>([]);
  protected readonly error = signal('');

  protected readonly columnas: ColumnaPedidos[] = [
    { estado: 'Pendiente',  accion: 'Empezar a preparar', color: 'metrica-amarillo' },
    { estado: 'Preparando', accion: 'Marcar entregado',   color: 'metrica-cielo' },
    { estado: 'Entregado',  accion: '',                   color: 'metrica-verde' }
  ];

  protected readonly porEntregar = computed(() =>
    this.pedidos().filter(pedido => pedido.estado_pedido !== 'Entregado').length
  );

  // El tablero se actualiza solo cada 20 segundos para ver los pedidos nuevos de la caja
  private intervalo: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.cargarPedidos();
    this.intervalo = setInterval(() => this.cargarPedidos(), 20000);
  }

  ngOnDestroy(): void {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  protected pedidosEn(estado: EstadoPedido): Venta[] {
    return this.pedidos().filter(pedido => pedido.estado_pedido === estado);
  }

  protected avanzar(pedido: Venta): void {
    this.error.set('');
    this.api.put(`/ventas/pedidos/${pedido.id_venta}/avanzar`).subscribe({
      next: () => this.cargarPedidos(),
      error: (mensaje: string) => {
        this.error.set(mensaje);
        this.cargarPedidos();
      }
    });
  }

  protected cargarPedidos(): void {
    this.api.get<Venta[]>('/ventas/pedidos').subscribe({
      next: (datos) => this.pedidos.set(datos),
      error: () => this.error.set('No se pudieron cargar los pedidos. Revisa que el servidor esté encendido.')
    });
  }
}
