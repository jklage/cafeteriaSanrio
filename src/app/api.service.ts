import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

// Única puerta al backend. Arma la dirección /api/..., regresa solo los "datos" de la respuesta
// y, si algo falla, entrega el mensaje de error que mandó el servidor.
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(ruta: string, params: Record<string, string> = {}): Observable<T> {
    return this.datos(this.http.get<{ datos: T }>(`/api${ruta}`, { params }));
  }

  post<T>(ruta: string, cuerpo: object = {}): Observable<T> {
    return this.datos(this.http.post<{ datos: T }>(`/api${ruta}`, cuerpo));
  }

  put<T>(ruta: string, cuerpo: object = {}): Observable<T> {
    return this.datos(this.http.put<{ datos: T }>(`/api${ruta}`, cuerpo));
  }

  delete<T>(ruta: string): Observable<T> {
    return this.datos(this.http.delete<{ datos: T }>(`/api${ruta}`));
  }

  private datos<T>(peticion: Observable<{ datos: T }>): Observable<T> {
    return peticion.pipe(
      map((respuesta) => respuesta.datos),
      catchError((respuesta: HttpErrorResponse) =>
        throwError(() => respuesta.error?.mensaje ?? 'No se pudo conectar con el servidor. Revisa que esté encendido.'))
    );
  }
}
