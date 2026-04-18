import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string) {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(value || 0)
}


export function formatTo12Hour(time: string | Date | null | undefined): string {
  if (!time) return '';
  
  try {
    const isString = typeof time === 'string';
    const isHHMM = isString && /^\d{2}:\d{2}$/.test(time as string);
    const date = isString 
      ? (isHHMM ? null : new Date(time as string))
      : time as Date;
      
    if (date && !isNaN(date.getTime())) {
      return date.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
    
    // Handle HH:mm format
    if (isHHMM) {
      const [hours, minutes] = (time as string).split(':');
      const dummyDate = new Date();
      dummyDate.setHours(parseInt(hours), parseInt(minutes || '0'), 0, 0);
      return dummyDate.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
    
    return String(time);
  } catch (error) {
    console.error('Error formatting time:', error);
    return String(time);
  }
}

