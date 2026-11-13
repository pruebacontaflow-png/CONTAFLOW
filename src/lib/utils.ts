import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  // Handle both ISO and YYYY-MM-DD formats
  const date = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function parseArgDate(dateStr: string): string {
  // Convert dd/mm/yyyy to yyyy-mm-dd
  if (!dateStr) return '';
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return dateStr;
}

export function calcularIVA(importe_neto: number, tipo_iva: string): number {
  const tasas: Record<string, number> = {
    '21%': 0.21,
    '10.5%': 0.105,
    'exento': 0,
    'no_gravado': 0,
  };
  return importe_neto * (tasas[tipo_iva] ?? 0.21);
}

export function getDiasHastaVencimiento(fechaVenc: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVenc + 'T00:00:00');
  const diff = venc.getTime() - hoy.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getColorVencimiento(dias: number): 'green' | 'yellow' | 'red' {
  if (dias < 0) return 'red';
  if (dias <= 7) return 'red';
  if (dias <= 30) return 'yellow';
  return 'green';
}
