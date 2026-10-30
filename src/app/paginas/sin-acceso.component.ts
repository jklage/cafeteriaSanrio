import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../auth.service';

// Se muestra dentro del marco del sistema cuando el rol no puede abrir la página pedida
@Component({
  selector: 'app-sin-acceso',
  imports: [RouterLink],
  template: `
    <section class="modulo-encabezado">
      <h1>Esta sección no está disponible para ti</h1>
      <p>
        {{ auth.usuario()?.nombre }}, tu cuenta tiene el rol <b>{{ auth.usuario()?.rol }}</b>
        y no tiene permiso para abrir esta página.
      </p>
    </section>

    <section class="panel">
      <h2>¿Qué puedes hacer?</h2>
      <p>Vuelve a tu pantalla de inicio o entra con otra cuenta.</p>
      <div class="acciones">
        <a class="boton boton-principal" [routerLink]="auth.rutaDeInicio()">Ir a mi inicio</a>
        <button type="button" class="boton boton-secundario" (click)="cerrarSesion()">Cerrar sesión</button>
      </div>
    </section>
  `,
  styles: `
    .panel p { color: var(--texto-suave); }
    a.boton { display: inline-block; text-decoration: none; }
  `
})
export class SinAccesoComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected cerrarSesion(): void {
    this.auth.cerrarSesion().subscribe(() => void this.router.navigateByUrl('/login'));
  }
}
