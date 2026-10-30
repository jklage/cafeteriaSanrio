import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../api.service';
import { ReporteVentas } from '../modelos';

// Convierte una fecha a texto AAAA-MM-DD con la hora local
function aTexto(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

@Component({
  selector: 'app-reportes',
  imports: [CurrencyPipe, DatePipe, FormsModule],
  templateUrl: './reportes.component.html',
  styleUrl: './reportes.component.css'
})
export class ReportesComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly reporte = signal<ReporteVentas | null>(null);
  protected readonly error = signal('');

  // Por defecto se muestran los últimos 7 días
  protected hasta = aTexto(new Date());
  protected desde = aTexto(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

  // El día con más ventas ocupa la barra completa; los demás, una parte
  private readonly ventaMaxima = computed(() =>
    Math.max(...(this.reporte()?.porDia ?? []).map(dia => Number(dia.total)), 1)
  );

  ngOnInit(): void {
    this.consultar();
  }

  protected consultar(): void {
    this.error.set('');
    this.api.get<ReporteVentas>('/finanzas/reporte', { desde: this.desde, hasta: this.hasta }).subscribe({
      next: (datos) => this.reporte.set(datos),
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  protected anchoBarra(total: number): number {
    return Math.round(Number(total) / this.ventaMaxima() * 100);
  }
}
