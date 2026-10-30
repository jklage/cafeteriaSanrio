import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { ApiService } from './api.service';
import { Rol, Usuario } from './modelos';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  // Usuario con la sesión abierta (null = nadie). Los componentes lo leen con usuario().
  readonly usuario = signal<Usuario | null>(null);

  // Evita preguntarle al servidor por la sesión en cada cambio de página
  private sesionRevisada = false;

  iniciarSesion(correo: string, contrasena: string): Observable<Usuario> {
    return this.api.post<Usuario>('/auth/login', { correo, contrasena }).pipe(
      tap((usuario) => this.guardarUsuario(usuario))
    );
  }

  // Pregunta al servidor si la cookie de sesión sigue siendo válida; cualquier error cuenta como "sin sesión"
  obtenerSesion(): Observable<Usuario | null> {
    if (this.sesionRevisada) return of(this.usuario());

    return this.api.get<Usuario>('/auth/sesion').pipe(
      catchError(() => of(null)),
      tap((usuario) => this.guardarUsuario(usuario))
    );
  }

  cerrarSesion(): Observable<unknown> {
    return this.api.post('/auth/logout').pipe(tap(() => this.guardarUsuario(null)));
  }

  // Página a la que llega cada rol al iniciar sesión
  rutaDeInicio(): string {
    const usuario = this.usuario();
    if (!usuario) return '/login';
    return usuario.rol === 'admin' ? '/resumen' : '/ventas';
  }

  private guardarUsuario(usuario: Usuario | null): void {
    this.usuario.set(usuario);
    this.sesionRevisada = true;
  }
}

// Guard: sin sesión abierta manda a /login
export const sesionGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService).obtenerSesion().pipe(
    map((usuario) => (usuario ? true : router.createUrlTree(['/login'])))
  );
};

// Guard: si el rol no está en data.roles de la ruta, manda a /sin-acceso
export const rolGuard: CanActivateFn = (ruta) => {
  const router = inject(Router);
  return inject(AuthService).obtenerSesion().pipe(
    map((usuario) => {
      if (!usuario) return router.createUrlTree(['/login']);
      return (ruta.data['roles'] as Rol[]).includes(usuario.rol) ? true : router.createUrlTree(['/sin-acceso']);
    })
  );
};
