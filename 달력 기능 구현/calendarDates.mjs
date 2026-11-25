export function dayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function monthStart(date, offset = 0) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

export function monthDates(month) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const start = new Date(year, monthIndex, 1).getDay();
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const rows = Math.max(5, Math.ceil((start + count) / 7));

  return Array.from({ length: rows * 7 }, (_, index) => {
    const day = index - start + 1;
    return day < 1 || day > count ? null : new Date(year, monthIndex, day);
  });
}
