import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../api.service';
import { Empleado } from '../modelos';

const FORMULARIO_VACIO = { nombre: '', puesto: '', turno: 'Matutino' };

@Component({
  selector: 'app-personal',
  imports: [FormsModule],
  templateUrl: './personal.component.html'
})
export class PersonalComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly empleados = signal<Empleado[]>([]);
  protected readonly mensaje = signal('');
  protected readonly error = signal('');

  protected readonly turnos = ['Matutino', 'Vespertino'];
  // null = se registra un empleado nuevo; un número = se edita ese empleado
  protected readonly idEditando = signal<number | null>(null);
  protected formulario = { ...FORMULARIO_VACIO };

  protected readonly enTurno = computed(() =>
    this.empleados().filter(e => e.hora_entrada !== null && e.hora_salida === null).length
  );

  protected readonly sinRegistro = computed(() =>
    this.empleados().filter(e => e.hora_entrada === null).length
  );

  ngOnInit(): void {
    this.cargarEmpleados();
  }

  protected estadoAsistencia(empleado: Empleado): string {
    if (empleado.hora_entrada === null) return 'Sin registro';
    if (empleado.hora_salida === null) return 'En turno';
    return 'Turno terminado';
  }

  protected registrarAsistencia(empleado: Empleado): void {
    this.mensaje.set('');
    this.error.set('');

    const esEntrada = empleado.hora_entrada === null;
    this.api.post(esEntrada ? '/rh/entrada' : '/rh/salida', { id_empleado: empleado.id_empleado }).subscribe({
      next: () => {
        this.mensaje.set(`${esEntrada ? 'Entrada' : 'Salida'} registrada para ${empleado.nombre}.`);
        this.cargarEmpleados();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  // Quita una salida registrada por error; la hora de entrada no cambia
  protected deshacerSalida(empleado: Empleado): void {
    this.mensaje.set('');
    this.error.set('');

    this.api.post('/rh/deshacer-salida', { id_empleado: empleado.id_empleado }).subscribe({
      next: () => {
        this.mensaje.set(`Se quitó la salida de ${empleado.nombre}. Sigue en turno desde las ${empleado.hora_entrada}.`);
        this.cargarEmpleados();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  protected editar(empleado: Empleado): void {
    this.mensaje.set('');
    this.error.set('');
    this.idEditando.set(empleado.id_empleado);
    this.formulario = { nombre: empleado.nombre, puesto: empleado.puesto, turno: empleado.turno };
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
      ? this.api.post<Empleado>('/rh/empleados', this.formulario)
      : this.api.put<Empleado>(`/rh/empleados/${id}`, this.formulario);

    peticion.subscribe({
      next: (empleado) => {
        this.mensaje.set(`${id === null ? 'Empleado registrado' : 'Cambios guardados'}: ${empleado.nombre}.`);
        this.cancelar();
        this.cargarEmpleados();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  // También se borra su historial de asistencias
  protected eliminar(empleado: Empleado): void {
    if (!confirm(`¿Eliminar a "${empleado.nombre}"? También se borrarán sus asistencias.`)) return;

    this.mensaje.set('');
    this.error.set('');
    this.api.delete(`/rh/empleados/${empleado.id_empleado}`).subscribe({
      next: () => {
        this.mensaje.set(`${empleado.nombre} se eliminó.`);
        if (this.idEditando() === empleado.id_empleado) this.cancelar();
        this.cargarEmpleados();
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  private cargarEmpleados(): void {
    this.api.get<Empleado[]>('/rh/empleados').subscribe({
      next: (datos) => this.empleados.set(datos),
      error: () => this.error.set('No se pudo cargar el personal. Revisa que el servidor esté encendido.')
    });
  }
}
