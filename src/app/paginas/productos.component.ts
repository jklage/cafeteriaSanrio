import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../api.service';
import { Categoria, Producto } from '../modelos';

// Campos del formulario; los números empiezan vacíos para que el usuario los escriba
interface FormularioProducto {
  codigo: string;
  nombre: string;
  descripcion: string;
  id_categoria: number | null;
  precio_venta: number | null;
  costo: number | null;
}

const FORMULARIO_VACIO: FormularioProducto = {
  codigo: '',
  nombre: '',
  descripcion: '',
  id_categoria: null,
  precio_venta: null,
  costo: null
};

@Component({
  selector: 'app-productos',
  imports: [CurrencyPipe, FormsModule],
  templateUrl: './productos.component.html'
})
export class ProductosComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly productos = signal<Producto[]>([]);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly mensaje = signal('');
  protected readonly error = signal('');

  // null = se está creando un producto nuevo; un número = se edita ese producto
  protected readonly idEditando = signal<number | null>(null);
  protected formulario: FormularioProducto = { ...FORMULARIO_VACIO };

  // Foto del producto como data URL (null = sin imagen); se guarda junto con el formulario
  protected readonly imagen = signal<string | null>(null);

  // Ganancia promedio por pieza vendida (precio menos costo)
  protected readonly margenPromedio = computed(() => {
    const lista = this.productos();
    if (lista.length === 0) return 0;
    const suma = lista.reduce((total, p) => total + this.margen(p), 0);
    return suma / lista.length;
  });

  ngOnInit(): void {
    this.cargarProductos();
    this.api.get<Categoria[]>('/ventas/categorias').subscribe({
      next: (datos) => this.categorias.set(datos),
      error: () => this.error.set('No se pudieron cargar las categorías.')
    });
  }

  protected margen(producto: Producto): number {
    return Number(producto.precio_venta) - Number(producto.costo ?? 0);
  }

  protected editar(producto: Producto): void {
    this.mensaje.set('');
    this.error.set('');
    this.idEditando.set(producto.id_producto);
    this.formulario = {
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      id_categoria: producto.id_categoria ?? null,
      precio_venta: Number(producto.precio_venta),
      costo: producto.costo === null ? null : Number(producto.costo)
    };
    this.imagen.set(producto.imagen);
  }

  protected cancelar(): void {
    this.idEditando.set(null);
    this.formulario = { ...FORMULARIO_VACIO };
    this.imagen.set(null);
  }

  // Lee la imagen elegida y la deja en vista previa; sirve para subirla o cambiarla
  protected elegirImagen(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';   // así se puede volver a elegir el mismo archivo
    if (!archivo) return;

    this.error.set('');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(archivo.type)) {
      this.error.set('La imagen debe ser PNG, JPG, WEBP o GIF.');
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      this.error.set('La imagen no puede pesar más de 2 MB.');
      return;
    }

    const lector = new FileReader();
    lector.onload = () => this.imagen.set(lector.result as string);
    lector.readAsDataURL(archivo);
  }

  protected guardar(): void {
    this.mensaje.set('');
    this.error.set('');

    if (this.formulario.costo === null) {
      this.error.set('Escribe el costo del producto.');
      return;
    }

    // Los campos vacíos se mandan como null para que el backend los ignore
    const datos: Partial<Producto> = {
      codigo: this.formulario.codigo.trim(),
      nombre: this.formulario.nombre.trim(),
      descripcion: this.formulario.descripcion.trim() || null,
      id_categoria: this.formulario.id_categoria,
      precio_venta: Number(this.formulario.precio_venta),
      costo: Number(this.formulario.costo),
      imagen: this.imagen()
    };

    const id = this.idEditando();
    const peticion = id === null
      ? this.api.post<Producto>('/ventas/productos', datos)
      : this.api.put<Producto>(`/ventas/productos/${id}`, datos);

    peticion.subscribe({
      next: (producto) => {
        this.mensaje.set(`${id === null ? 'Producto agregado' : 'Cambios guardados'}: ${producto.nombre}.`);
        this.cancelar();
        this.cargarProductos();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  // Dar de baja no borra el producto: lo marca como no disponible y deja de salir en el menú
  protected darDeBaja(producto: Producto): void {
    if (!confirm(`¿Dar de baja "${producto.nombre}"? Ya no aparecerá en el punto de venta.`)) return;

    this.mensaje.set('');
    this.error.set('');
    this.api.delete(`/ventas/productos/${producto.id_producto}`).subscribe({
      next: () => {
        this.mensaje.set(`${producto.nombre} se dio de baja.`);
        if (this.idEditando() === producto.id_producto) this.cancelar();
        this.cargarProductos();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  private cargarProductos(): void {
    this.api.get<Producto[]>('/ventas/productos').subscribe({
      next: (datos) => this.productos.set(datos),
      error: () => this.error.set('No se pudo cargar el menú. Revisa que el servidor esté encendido.')
    });
  }
}
