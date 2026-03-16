const isDateOnlyInput = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const parseDateFromQuery = (
  value: string | undefined,
  bound: 'start' | 'end'
): Date | undefined => {
  if (!value) return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  if (isDateOnlyInput(value)) {
    if (bound === 'start') {
      parsed.setHours(0, 0, 0, 0);
    } else {
      parsed.setHours(23, 59, 59, 999);
    }
  }

  return parsed;
};
