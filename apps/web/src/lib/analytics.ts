/**
 * Eventos para Google Analytics via Google Tag Manager (index.html carga GTM-M962X2VS). Cada
 * evento llega a GA4 solo si en GTM hay una etiqueta de evento GA4 con el activador del mismo
 * nombre (ej. "sign_up"). Sin GTM cargado (bloqueador de anuncios, desarrollo) no hace nada.
 */
type DataLayerWindow = Window & { dataLayer?: Record<string, unknown>[] };

export function trackEvent(event: string, params: Record<string, unknown> = {}): void {
  try {
    const w = window as DataLayerWindow;
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event, ...params });
  } catch {
    // La medicion nunca debe romper el registro ni la pagina.
  }
}
