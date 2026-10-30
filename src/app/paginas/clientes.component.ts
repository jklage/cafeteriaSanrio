import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../api.service';
import { Cliente } from '../modelos';

type DatosCliente = Pick<Cliente, 'nombre' | 'telefono' | 'correo'>;

const FORMULARIO_VACIO: DatosCliente = { nombre: '', telefono: '', correo: '' };

@Component({
  selector: 'app-clientes',
  imports: [FormsModule],
  templateUrl: './clientes.component.html'
})
export class ClientesComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly mensaje = signal('');
  protected readonly error = signal('');
  protected busqueda = '';

  // null = se registra un cliente nuevo; un número = se edita ese cliente
  protected readonly idEditando = signal<number | null>(null);
  protected formulario: DatosCliente = { ...FORMULARIO_VACIO };

  ngOnInit(): void {
    this.cargarClientes();
  }

  // Regresa solo los clientes cuyo nombre contiene lo que se escribió en el buscador
  protected clientesFiltrados(): Cliente[] {
    const texto = this.busqueda.trim().toLowerCase();
    return this.clientes().filter(cliente => cliente.nombre.toLowerCase().includes(texto));
  }

  protected editar(cliente: Cliente): void {
    this.mensaje.set('');
    this.error.set('');
    this.idEditando.set(cliente.id_cliente);
    this.formulario = {
      nombre: cliente.nombre,
      telefono: cliente.telefono ?? '',
      correo: cliente.correo ?? ''
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
      ? this.api.post<Cliente>('/ventas/clientes', this.formulario)
      : this.api.put<Cliente>(`/ventas/clientes/${id}`, this.formulario);

    peticion.subscribe({
      next: (cliente) => {
        this.mensaje.set(`${id === null ? 'Cliente registrado' : 'Cambios guardados'}: ${cliente.nombre}.`);
        this.cancelar();
        this.cargarClientes();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  // Sus ventas anteriores se conservan porque guardan el nombre del cliente
  protected eliminar(cliente: Cliente): void {
    if (!confirm(`¿Eliminar a "${cliente.nombre}"? Ya no aparecerá al vender.`)) return;

    this.mensaje.set('');
    this.error.set('');
    this.api.delete(`/ventas/clientes/${cliente.id_cliente}`).subscribe({
      next: () => {
        this.mensaje.set(`${cliente.nombre} se eliminó.`);
        if (this.idEditando() === cliente.id_cliente) this.cancelar();
        this.cargarClientes();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  private cargarClientes(): void {
    this.api.get<Cliente[]>('/ventas/clientes').subscribe({
      next: (datos) => this.clientes.set(datos),
      error: () => this.error.set('No se pudieron cargar los clientes. Revisa que el servidor esté encendido.')
    });
  }
}
