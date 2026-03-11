export const formatDate = (date: Date, format = 'yyyy-MM-dd'): string => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return format
    .replace('yyyy', String(year))
    .replace('MM', month)
    .replace('dd', day);
};

export const getDateRange = (range: 'today' | 'week' | 'month' | 'year') => {
  const now = new Date();
  const start = new Date();
  
  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      break;
  }
  
  return { start, end: now };
};