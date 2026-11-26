export const EMPTY_BIRTH = { year: null, month: null, day: null };
export const DATE_LABELS = { year: '년도', month: '월', day: '일' };
export const STORAGE_KEY = 'oneureun.service-start';

const currentYear = new Date().getFullYear();
const numbers = (length, first = 1) => Array.from({ length }, (_, i) => first + i);
const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

export function dateOptions(part, birth) {
  if (part === 'year') return numbers(currentYear - 1899, 1900);
  if (part === 'month') return numbers(12);
  return numbers(daysInMonth(birth.year ?? 2000, birth.month ?? 1));
}

export function updateBirth(birth, part, value) {
  const next = { ...birth, [part]: value };
  if (next.day && next.month) {
    next.day = Math.min(next.day, daysInMonth(next.year ?? 2000, next.month));
  }
  return next;
}

export function birthDateString({ year, month, day }) {
  if (!year || !month || !day || day > daysInMonth(year, month)) return null;
  if (new Date(year, month - 1, day) > new Date()) return null;
  return [year, month, day].map((part) => String(part).padStart(2, '0')).join('-');
}

export function formatPhone(input) {
  const digits = input.replace(/\D/g, '').slice(0, 11);
  const area = digits.startsWith('02') ? 2 : 3;
  if (digits.length <= area) return digits;
  const middle = digits.length > area + 7 ? 4 : 3;
  return [
    digits.slice(0, area),
    digits.slice(area, area + middle),
    digits.slice(area + middle),
  ].filter(Boolean).join('-');
}

export function isPhoneNumber(phone) {
  return /^(?:010-\d{4}|01[16789]-\d{3,4}|02-\d{3,4}|0[3-6][1-5]-\d{3,4}|070-\d{4})-\d{4}$/.test(phone);
}
