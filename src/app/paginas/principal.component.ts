import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../auth.service';
import { MODULOS } from '../modulos';

// Marco del sistema: barra superior, menú de módulos y la página actual
@Component({
  selector: 'app-principal',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './principal.component.html',
  styleUrl: './principal.component.css'
})
export class PrincipalComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly usuario = this.auth.usuario;

  // Solo se muestran los módulos que el rol del usuario puede abrir
  protected readonly modulosVisibles = computed(() => {
    const usuario = this.usuario();
    return usuario ? MODULOS.filter(modulo => modulo.roles.includes(usuario.rol)) : [];
  });

  // Fecha de hoy en español, por ejemplo: "domingo, 18 de octubre de 2026"
  protected readonly fechaHoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  protected cerrarSesion(): void {
    this.auth.cerrarSesion().subscribe(() => void this.router.navigateByUrl('/login'));
  }
}
