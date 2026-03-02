exports.extractMonthYear = (date) => {
  const d = new Date(date);

  // ❌ Invalid date protection
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date format');
  }

  return {
    month: d.getMonth() + 1,
    year: d.getFullYear()
  };
};
