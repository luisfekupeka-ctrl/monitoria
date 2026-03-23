import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  if (!date) return '';
  const dateStr = typeof date === 'string' ? date : date.toISOString();
  // Ensure we don't shift timezone if it's just a date string like YYYY-MM-DD
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('pt-BR');
}
