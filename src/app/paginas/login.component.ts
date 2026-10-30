import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // Campos del formulario (se enlazan con [(ngModel)])
  protected correo = '';
  protected contrasena = '';

  protected readonly cargando = signal(false);
  protected readonly error = signal('');

  protected iniciarSesion(): void {
    if (this.cargando()) return;

    this.error.set('');
    this.cargando.set(true);

    this.auth.iniciarSesion(this.correo, this.contrasena).subscribe({
      // Cada rol llega a su propia pantalla de inicio
      next: () => void this.router.navigateByUrl(this.auth.rutaDeInicio()),
      error: (mensaje: string) => {
        this.cargando.set(false);
        this.error.set(mensaje);
      }
    });
  }
}
