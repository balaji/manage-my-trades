const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NAIVE_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

export function toChartUnixSeconds(value: string): number {
  if (DATE_ONLY_PATTERN.test(value)) {
    return Date.parse(`${value}T00:00:00Z`) / 1000;
  }

  if (NAIVE_DATETIME_PATTERN.test(value)) {
    return Date.parse(`${value}Z`) / 1000;
  }

  return Date.parse(value) / 1000;
}
