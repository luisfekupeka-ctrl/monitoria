import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'Data Inválida';
  
  // Se for apenas uma data (YYYY-MM-DD), o JS pode interpretar como UTC e deslocar
  // Para evitar isso, se a string não tem T (tempo), forçamos local
  if (typeof date === 'string' && !date.includes('T')) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
  }
  
  return d.toLocaleDateString('pt-BR');
}

export function formatTime(date: string | Date | null | undefined) {
  if (!date) return '--:--';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '--:--';
  
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Retorna o offset do fuso horário local formatado como +HH:mm ou -HH:mm
 */
export function getTimezoneOffset() {
  const offsetMinutes = -new Date().getTimezoneOffset();
  const absOffset = Math.abs(offsetMinutes);
  const hoursOffset = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const minsOffset = String(absOffset % 60).padStart(2, '0');
  const sign = offsetMinutes >= 0 ? '+' : '-';
  return `${sign}${hoursOffset}:${minsOffset}`;
}

export function formatReturnDate(date: string | null | undefined) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const day = d.toLocaleDateString('pt-BR');
  const today = new Date().toLocaleDateString('pt-BR');
  
  if (day === today) return `Hoje às ${time}`;
  return `${day} às ${time}`;
}
