import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../api.service';
import { Proveedor } from '../modelos';

// total_insumos lo calcula el backend
type DatosProveedor = Omit<Proveedor, 'id_proveedor' | 'total_insumos'>;

const FORMULARIO_VACIO: DatosProveedor = { nombre: '', contacto: '', telefono: '', correo: '' };

@Component({
  selector: 'app-proveedores',
  imports: [FormsModule],
  templateUrl: './proveedores.component.html'
})
export class ProveedoresComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly proveedores = signal<Proveedor[]>([]);
  protected readonly mensaje = signal('');
  protected readonly error = signal('');

  // null = se registra un proveedor nuevo; un número = se edita ese proveedor
  protected readonly idEditando = signal<number | null>(null);
  protected formulario: DatosProveedor = { ...FORMULARIO_VACIO };

  ngOnInit(): void {
    this.cargarProveedores();
  }

  protected editar(proveedor: Proveedor): void {
    this.mensaje.set('');
    this.error.set('');
    this.idEditando.set(proveedor.id_proveedor);
    this.formulario = {
      nombre: proveedor.nombre,
      contacto: proveedor.contacto ?? '',
      telefono: proveedor.telefono ?? '',
      correo: proveedor.correo ?? ''
    };
  }

  protected cancelar(): void {
    this.idEditando.set(null);
    this.formulario = { ...FORMULARIO_VACIO };
  }

  protected guardar(): void {
    this.mensaje.set('');
    this.error.set('');

    const id = this.idEditando();
    const peticion = id === null
      ? this.api.post<Proveedor>('/proveedores', this.formulario)
      : this.api.put<Proveedor>(`/proveedores/${id}`, this.formulario);

    peticion.subscribe({
      next: (proveedor) => {
        this.mensaje.set(`${id === null ? 'Proveedor registrado' : 'Cambios guardados'}: ${proveedor.nombre}.`);
        this.cancelar();
        this.cargarProveedores();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  protected darDeBaja(proveedor: Proveedor): void {
    if (!confirm(`¿Dar de baja a "${proveedor.nombre}"?`)) return;

    this.mensaje.set('');
    this.error.set('');
    this.api.delete(`/proveedores/${proveedor.id_proveedor}`).subscribe({
      next: () => {
        this.mensaje.set(`${proveedor.nombre} se dio de baja.`);
        if (this.idEditando() === proveedor.id_proveedor) this.cancelar();
        this.cargarProveedores();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  private cargarProveedores(): void {
    this.api.get<Proveedor[]>('/proveedores').subscribe({
      next: (datos) => this.proveedores.set(datos),
      error: () => this.error.set('No se pudieron cargar los proveedores. Revisa que el servidor esté encendido.')
    });
  }
}
