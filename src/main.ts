import { Component, provideBrowserGlobalErrorListeners } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { RouterOutlet, Routes, provideRouter } from '@angular/router';

import { rolGuard, sesionGuard } from './app/auth.service';
import { MODULOS } from './app/modulos';
import { LoginComponent } from './app/paginas/login.component';
import { PrincipalComponent } from './app/paginas/principal.component';
import { SinAccesoComponent } from './app/paginas/sin-acceso.component';

// Rutas: el login es público; los módulos van dentro del marco principal y cada uno revisa el rol
const rutas: Routes = [
  { path: 'login', component: LoginComponent, title: 'Café Sanrio | Iniciar sesión' },
  {
    path: '',
    component: PrincipalComponent,
    canActivate: [sesionGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'resumen' },
      ...MODULOS.map((modulo) => ({
        path: modulo.ruta,
        component: modulo.pagina,
        canActivate: [rolGuard],
        data: { roles: modulo.roles },
        title: `Café Sanrio | ${modulo.nombre}`
      })),
      { path: 'sin-acceso', component: SinAccesoComponent, title: 'Café Sanrio | Sin acceso' }
    ]
  },
  { path: '**', redirectTo: '' }
];

// Componente raíz: solo muestra la página de la ruta actual
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />'
})
class App {}

bootstrapApplication(App, {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(rutas), provideHttpClient(withFetch())]
}).catch((error) => console.error(error));
