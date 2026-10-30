import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../api.service';
import { Categoria, Entrada, Insumo, Proveedor } from '../modelos';

@Component({
  selector: 'app-inventario',
  imports: [CurrencyPipe, DatePipe, FormsModule],
  templateUrl: './inventario.component.html'
})
export class InventarioComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly insumos = signal<Insumo[]>([]);
  protected readonly entradas = signal<Entrada[]>([]);
  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly mensaje = signal('');
  protected readonly error = signal('');

  protected readonly insumosEnAlerta = computed(() =>
    this.insumos().filter(insumo => insumo.requiere_reabasto).length
  );

  // Formulario de entrada de mercancía
  protected entrada = { id_insumo: null as number | null, cantidad: null as number | null, costo_total: null as number | null };

  // Unidades permitidas; las piezas solo aceptan enteros
  protected readonly unidades = ['litros', 'piezas', 'kilogramos'];

  // null = se registra un insumo nuevo; un número = se edita ese insumo
  protected readonly idEditando = signal<number | null>(null);
  protected formulario = this.insumoVacio();

  ngOnInit(): void {
    this.cargarInsumos();
    this.cargarEntradas();
    this.api.get<Proveedor[]>('/proveedores').subscribe({
      next: (datos) => this.proveedores.set(datos),
      error: () => this.error.set('No se pudieron cargar los proveedores.')
    });
    this.api.get<Categoria[]>('/ventas/categorias').subscribe(datos => this.categorias.set(datos));
  }

  // El botón "Reabastecer" de la tabla deja elegido ese insumo en el formulario de entrada
  protected prepararEntrada(insumo: Insumo): void {
    this.entrada = { id_insumo: insumo.id_insumo, cantidad: null, costo_total: null };
  }

  // Con piezas el campo avanza de 1 en 1; con litros y kilos acepta decimales
  protected paso(unidad: string): number {
    return unidad === 'piezas' ? 1 : 0.01;
  }

  protected unidadSeleccionada(): string {
    return this.insumos().find(insumo => insumo.id_insumo === this.entrada.id_insumo)?.unidad ?? '';
  }

  protected registrarEntrada(): void {
    this.mensaje.set('');
    this.error.set('');

    this.api.post('/inventario/entradas', {
      id_insumo: Number(this.entrada.id_insumo),
      cantidad: Number(this.entrada.cantidad),
      costo_total: this.entrada.costo_total
    }).subscribe({
      next: () => {
        const insumo = this.insumos().find(i => i.id_insumo === this.entrada.id_insumo);
        this.mensaje.set(`Entrada registrada: ${this.entrada.cantidad} ${insumo?.unidad ?? ''} de ${insumo?.nombre ?? 'insumo'}.`);
        this.entrada = { id_insumo: null, cantidad: null, costo_total: null };
        this.cargarInsumos();
        this.cargarEntradas();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  protected nombreCategorias(insumo: Insumo): string {
    return this.categorias()
      .filter(categoria => insumo.categorias.includes(categoria.id_categoria))
      .map(categoria => categoria.nombre)
      .join(', ') || 'Sin categoría';
  }

  // Marca o desmarca una categoría en el formulario
  protected cambiarCategoria(idCategoria: number): void {
    const elegidas = this.formulario.categorias;
    this.formulario.categorias = elegidas.includes(idCategoria)
      ? elegidas.filter(id => id !== idCategoria)
      : [...elegidas, idCategoria];
  }

  protected editar(insumo: Insumo): void {
    this.mensaje.set('');
    this.error.set('');
    this.idEditando.set(insumo.id_insumo);
    this.formulario = {
      nombre: insumo.nombre,
      unidad: insumo.unidad,
      stock_actual: Number(insumo.stock_actual),
      stock_minimo: Number(insumo.stock_minimo),
      id_proveedor: insumo.id_proveedor,
      categorias: [...insumo.categorias]
    };
  }

  protected cancelar(): void {
    this.idEditando.set(null);
    this.formulario = this.insumoVacio();
  }

  protected guardarInsumo(): void {
    this.mensaje.set('');
    this.error.set('');

    const datos = {
      nombre: this.formulario.nombre.trim(),
      unidad: this.formulario.unidad,
      stock_actual: Number(this.formulario.stock_actual ?? 0),
      stock_minimo: Number(this.formulario.stock_minimo),
      id_proveedor: this.formulario.id_proveedor,
      categorias: this.formulario.categorias
    };

    const id = this.idEditando();
    const peticion = id === null
      ? this.api.post('/inventario/insumos', datos)
      : this.api.put(`/inventario/insumos/${id}`, datos);

    peticion.subscribe({
      next: () => {
        this.mensaje.set(`${id === null ? 'Insumo registrado' : 'Cambios guardados'}: ${datos.nombre}.`);
        this.cancelar();
        this.cargarInsumos();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  // Borrar solo lo oculta; las ventas y entradas anteriores se conservan
  protected borrar(insumo: Insumo): void {
    if (!confirm(`¿Borrar "${insumo.nombre}"? Ya no aparecerá en inventario ni en el punto de venta.`)) return;

    this.mensaje.set('');
    this.error.set('');
    this.api.delete(`/inventario/insumos/${insumo.id_insumo}`).subscribe({
      next: () => {
        this.mensaje.set(`${insumo.nombre} se borró.`);
        if (this.idEditando() === insumo.id_insumo) this.cancelar();
        if (this.entrada.id_insumo === insumo.id_insumo) this.entrada.id_insumo = null;
        this.cargarInsumos();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  private insumoVacio() {
    return {
      nombre: '',
      unidad: 'litros',
      stock_actual: null as number | null,
      stock_minimo: null as number | null,
      id_proveedor: null as number | null,
      categorias: [] as number[]
    };
  }

  private cargarInsumos(): void {
    this.api.get<Insumo[]>('/inventario/insumos').subscribe({
      next: (datos) => this.insumos.set(datos),
      error: () => this.error.set('No se pudo cargar el inventario. Revisa que el servidor esté encendido.')
    });
  }

  private cargarEntradas(): void {
    this.api.get<Entrada[]>('/inventario/entradas').subscribe({
      next: (datos) => this.entradas.set(datos),
      error: () => this.error.set('No se pudieron cargar las entradas de mercancía.')
    });
  }
}
