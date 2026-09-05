const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Validates year, month (1-12), and day (1-31) calendar-wise and ensures no future date.
 * Returns { isValid: boolean, error: string | null, isoDate: string }
 */
function validateCalendarDate(year, month, day) {
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    return { isValid: false, error: 'Invalid date values' };
  }

  if (y < 1900 || y > 2100) {
    return { isValid: false, error: `Year ${y} is out of valid range (1900-2100)` };
  }

  if (m < 1 || m > 12) {
    return { isValid: false, error: `Invalid month (${m}). Month must be between 1 and 12.` };
  }

  // Days in month: new Date(y, m, 0).getDate() gives exact days in month m
  const daysInMonth = new Date(y, m, 0).getDate();
  const mName = monthNames[m - 1];

  if (d < 1 || d > daysInMonth) {
    return {
      isValid: false,
      error: `Invalid date: ${mName} ${y} only has ${daysInMonth} days (got ${d}).`
    };
  }

  const isoDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // Check future date against today's local date
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  if (isoDate > todayIso) {
    const formattedInput = `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
    const formattedToday = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    return {
      isValid: false,
      error: `Future date not allowed: ${formattedInput} is in the future (today is ${formattedToday}).`,
      isoDate
    };
  }

  return { isValid: true, error: null, isoDate };
}

exports.validateCalendarDate = validateCalendarDate;

exports.extractMonthYear = (date) => {
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const v = validateCalendarDate(match[1], match[2], match[3]);
      if (!v.isValid) {
        throw new Error(v.error);
      }
      return {
        month: parseInt(match[2], 10),
        year: parseInt(match[1], 10)
      };
    }
  }

  const d = new Date(date);

  // Invalid date protection
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date format');
  }

  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (d > todayEnd) {
    const formattedToday = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const formattedInput = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    throw new Error(`Future date not allowed: ${formattedInput} is in the future (today is ${formattedToday}).`);
  }

  return {
    month: d.getMonth() + 1,
    year: d.getFullYear()
  };
};

