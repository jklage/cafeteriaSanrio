import { CurrencyPipe } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../api.service';
import { Cliente, Insumo, ItemVenta, Producto, Venta } from '../modelos';

type InsumoSeleccionado = ItemVenta['insumos'][number];

// Lo que regresa el backend al guardar una venta
interface VentaRegistrada {
  id_venta: number;
  total: number;
}

// Una línea del ticket: producto, cantidad y los insumos extra que se le agregaron
interface LineaTicket {
  producto: Producto;
  cantidad: number;
  insumos: InsumoSeleccionado[];
  descripcionInsumos: string;
}

// Lo que usamos del SDK de PayPal, que se carga con una etiqueta <script>
interface SesionPayPal {
  start(opciones: { presentationMode: string }, orden: Promise<{ orderId: string }>): Promise<void>;
}

declare const paypal: {
  createInstance(opciones: {
    clientToken: string;
    components: string[];
    pageType: string;
  }): Promise<{
    findEligibleMethods(opciones: { currencyCode: string }): Promise<{
      isEligible(metodo: string): boolean;
    }>;
    createPayPalOneTimePaymentSession(opciones: {
      onApprove(datos: { orderId: string }): Promise<void>;
      onCancel(): void;
      onError(): void;
    }): SesionPayPal;
  }>;
};

@Component({
  selector: 'app-ventas',
  imports: [CurrencyPipe, FormsModule],
  templateUrl: './ventas.component.html',
  styleUrl: './ventas.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]   // permite usar la etiqueta <paypal-button>
})
export class VentasComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly productos = signal<Producto[]>([]);
  protected readonly insumos = signal<Insumo[]>([]);
  protected readonly ventas = signal<Venta[]>([]);
  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly clienteSeleccionado = signal<Cliente | null>(null);
  protected readonly productoSeleccionado = signal<Producto | null>(null);
  protected readonly insumosSeleccionados = signal<Record<number, number>>({});
  protected readonly ticket = signal<LineaTicket[]>([]);
  protected readonly mensaje = signal('');
  protected readonly error = signal('');
  protected readonly paypalListo = signal(false);
  protected readonly avisoPayPal = signal('Cargando PayPal...');

  // Venta de la que se va a mandar la factura por correo (null = ninguna)
  protected readonly ventaFactura = signal<Venta | null>(null);
  protected correoFactura = '';

  private sesionPayPal: SesionPayPal | null = null;
  private itemsPayPal: ItemVenta[] = [];

  // Campos del formulario del ticket (se enlazan con [(ngModel)])
  protected busquedaCliente = '';
  protected cantidad = 1;
  protected metodoPago = 'Tarjeta';
  protected readonly metodosPago = ['Tarjeta', 'Efectivo', 'Transferencia', 'PayPal'];

  ngOnInit(): void {
    this.cargarProductos();
    this.cargarInsumos();
    this.cargarVentas();
    this.cargarClientes();
    this.cargarPayPal();
  }

  protected seleccionarProducto(producto: Producto): void {
    this.productoSeleccionado.set(producto);
    this.cantidad = 1;
    this.insumosSeleccionados.set({});
  }

  // Solo los insumos permitidos para la categoría del producto elegido
  protected readonly insumosDelProducto = computed(() => {
    const producto = this.productoSeleccionado();
    if (!producto) return [];
    return this.insumos().filter(insumo => insumo.categorias.includes(Number(producto.id_categoria)));
  });

  // Busca por nombre, teléfono o correo
  protected clientesFiltrados(): Cliente[] {
    const texto = this.busquedaCliente.trim().toLowerCase();
    return this.clientes().filter(cliente =>
      [cliente.nombre, cliente.telefono ?? '', cliente.correo ?? ''].some(dato => dato.toLowerCase().includes(texto))
    );
  }

  protected cantidadInsumo(idInsumo: number): number {
    return this.insumosSeleccionados()[idInsumo] ?? 0;
  }

  protected maximaCantidadInsumo(insumo: Insumo): number {
    return Math.min(5, Math.floor(Number(insumo.stock_actual)));
  }

  protected cambiarCantidadInsumo(insumo: Insumo, cambio: number): void {
    const actual = this.cantidadInsumo(insumo.id_insumo);
    const maxima = this.maximaCantidadInsumo(insumo);
    const siguiente = Math.max(0, Math.min(maxima, actual + cambio));
    const cantidades = { ...this.insumosSeleccionados() };

    if (siguiente === 0) {
      delete cantidades[insumo.id_insumo];
    } else {
      cantidades[insumo.id_insumo] = siguiente;
    }
    this.insumosSeleccionados.set(cantidades);
  }

  protected insumosParaVenta(): InsumoSeleccionado[] {
    return Object.entries(this.insumosSeleccionados()).map(([idInsumo, cantidad]) => ({
      idInsumo: Number(idInsumo),
      cantidad
    }));
  }

  // Los insumos extra no cambian el precio; solo se descuentan del inventario
  protected readonly total = computed(() =>
    this.ticket().reduce((suma, linea) => suma + Number(linea.producto.precio_venta) * linea.cantidad, 0)
  );

  protected readonly articulos = computed(() =>
    this.ticket().reduce((suma, linea) => suma + linea.cantidad, 0)
  );

  // Pasa el producto elegido (con su cantidad y extras) al ticket
  protected agregarAlTicket(): void {
    const producto = this.productoSeleccionado();
    this.mensaje.set('');
    this.error.set('');

    if (!producto) {
      this.error.set('Elige un producto del menú.');
      return;
    }
    if (!Number.isInteger(this.cantidad) || this.cantidad < 1) {
      this.error.set('La cantidad debe ser un número entero de al menos 1.');
      return;
    }

    const insumos = this.insumosParaVenta();
    const descripcionInsumos = insumos
      .map(extra => `${this.insumos().find(i => i.id_insumo === extra.idInsumo)?.nombre} x${extra.cantidad}`)
      .join(', ');

    this.ticket.update(lineas => [...lineas, { producto, cantidad: this.cantidad, insumos, descripcionInsumos }]);
    this.cantidad = 1;
    this.insumosSeleccionados.set({});
  }

  protected quitarDelTicket(indice: number): void {
    this.ticket.update(lineas => lineas.filter((_, i) => i !== indice));
  }

  protected registrarVenta(): void {
    const items = this.validarVenta();
    if (!items) {
      return;
    }

    this.api.post<VentaRegistrada>('/ventas', { idCliente: this.clienteSeleccionado()!.id_cliente, metodoPago: this.metodoPago, items }).subscribe({
      next: (venta) => this.ventaGuardada(venta),
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  // Abre la ventana de PayPal; la orden se crea en el backend con el total real
  protected pagarConPayPal(): void {
    const items = this.validarVenta();
    if (!items || !this.sesionPayPal) {
      return;
    }

    this.itemsPayPal = items;

    const orden = firstValueFrom(this.api.post<{ id: string }>('/paypal/orden', { items: this.itemsPayPal }))
      .then((respuesta) => ({ orderId: respuesta.id }));

    this.sesionPayPal.start({ presentationMode: 'auto' }, orden)
      .catch(() => this.error.set('No se pudo iniciar el pago con PayPal.'));
  }

  // Convierte el ticket al formato que espera el backend
  private validarVenta(): ItemVenta[] | null {
    this.mensaje.set('');
    this.error.set('');

    if (this.ticket().length === 0) {
      this.error.set('Agrega al menos un producto al ticket antes de cobrar.');
      return null;
    }
    if (!this.clienteSeleccionado()) {
      this.error.set('Elige un cliente de la lista.');
      return null;
    }
    return this.ticket().map(linea => ({
      idProducto: linea.producto.id_producto,
      cantidad: linea.cantidad,
      insumos: linea.insumos
    }));
  }

  private ventaGuardada(venta: VentaRegistrada): void {
    this.mensaje.set(`Venta #${venta.id_venta} registrada por ${this.articulos()} artículo(s). El pedido ya aparece como pendiente en Pedidos.`);
    this.ticket.set([]);
    this.clienteSeleccionado.set(null);
    this.busquedaCliente = '';
    this.cantidad = 1;
    this.insumosSeleccionados.set({});
    this.cargarInsumos();
    this.cargarVentas();
  }

  // Cuando el cliente aprueba en PayPal, el backend cobra y guarda la venta
  private async capturarPago(orderId: string): Promise<void> {
    try {
      const venta = await firstValueFrom(this.api.post<VentaRegistrada>('/paypal/captura', {
        orderId,
        idCliente: this.clienteSeleccionado()!.id_cliente,
        items: this.itemsPayPal
      }));
      this.ventaGuardada(venta);
    } catch (mensaje) {
      this.error.set(String(mensaje));
    }
  }

  // El script de PayPal solo se agrega una vez aunque se vuelva a entrar a Ventas
  private cargarPayPal(): void {
    if ('paypal' in window) {
      this.iniciarPayPal();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.sandbox.paypal.com/web-sdk/v6/core';
    script.onload = () => this.iniciarPayPal();
    script.onerror = () => this.avisoPayPal.set('No se pudo cargar PayPal. Revisa tu conexión a internet.');
    document.body.appendChild(script);
  }

  private async iniciarPayPal(): Promise<void> {
    try {
      const { clientToken } = await firstValueFrom(this.api.get<{ clientToken: string }>('/paypal/config'));
      const sdk = await paypal.createInstance({
        clientToken,
        components: ['paypal-payments'],
        pageType: 'checkout'
      });

      const metodos = await sdk.findEligibleMethods({ currencyCode: 'MXN' });
      if (!metodos.isEligible('paypal')) {
        this.avisoPayPal.set('PayPal no está disponible para esta cuenta.');
        return;
      }

      this.sesionPayPal = sdk.createPayPalOneTimePaymentSession({
        onApprove: (datos) => this.capturarPago(datos.orderId),
        onCancel: () => this.error.set('Pago con PayPal cancelado.'),
        onError: () => this.error.set('Error al procesar el pago con PayPal.')
      });
      this.paypalListo.set(true);
    } catch {
      this.avisoPayPal.set('No se pudo iniciar PayPal. Revisa las credenciales del .env.');
    }
  }

  private cargarProductos(): void {
    this.api.get<Producto[]>('/ventas/productos').subscribe({
      next: (datos) => {
        this.productos.set(datos);
        this.productoSeleccionado.set(datos[0] ?? null);
      },
      error: () => this.error.set('No se pudo cargar el menú. Revisa que el servidor esté encendido.')
    });
  }

  protected enviarFactura(): void {
    const venta = this.ventaFactura();
    if (!venta) return;

    this.mensaje.set('');
    this.error.set('');
    this.api.post<{ correo: string }>(`/ventas/${venta.id_venta}/enviar`, { correo: this.correoFactura }).subscribe({
      next: (datos) => {
        this.mensaje.set(`Factura enviada a ${datos.correo}`);
        this.ventaFactura.set(null);
        this.correoFactura = '';
      },
      error: (mensaje: string) => this.error.set(mensaje)
    });
  }

  private cargarClientes(): void {
    this.api.get<Cliente[]>('/ventas/clientes').subscribe({
      next: (datos) => this.clientes.set(datos),
      error: () => this.error.set('No se pudo cargar la lista de clientes.')
    });
  }

  private cargarVentas(): void {
    this.api.get<Venta[]>('/ventas').subscribe(datos => this.ventas.set(datos));
  }

  private cargarInsumos(): void {
    this.api.get<Insumo[]>('/inventario/insumos').subscribe({
      next: (datos) => this.insumos.set(datos),
      error: () => this.error.set('No se pudo cargar el inventario de insumos.')
    });
  }
}
