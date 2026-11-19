export const CAMPUS_TIME_ZONE = 'America/Sao_Paulo';

const CAMPUS_UTC_OFFSET = '-03:00';

export function formatCampusDayMonth(value: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: CAMPUS_TIME_ZONE,
  })
    .format(toDate(value))
    .replace('.', '')
    .toUpperCase();
}

export function formatCampusDateTimeLabel(value: Date) {
  const day = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    timeZone: CAMPUS_TIME_ZONE,
  }).format(value);
  const month = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    timeZone: CAMPUS_TIME_ZONE,
  })
    .format(value)
    .replace('.', '')
    .toUpperCase();
  const time = formatCampusTime(value);

  return `${day} ${month} · ${time}`;
}

export function formatCampusTimeRange(value: string | Date, end?: string | Date | null) {
  const startDate = toDate(value);
  const endDate = end ? toDate(end) : new Date(startDate.getTime() + 90 * 60 * 1000);

  return `${formatCampusTime(startDate)} - ${formatCampusTime(endDate)}`;
}

export function getCampusDateKey(value: string | Date) {
  const parts = getCampusDateParts(value);

  return `${getPart(parts, 'year')}-${getPart(parts, 'month')}-${getPart(parts, 'day')}`;
}

export function toCampusDateTimeIso(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: CAMPUS_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(value);
  const year = getPart(parts, 'year');
  const month = getPart(parts, 'month');
  const day = getPart(parts, 'day');
  const hours = getPart(parts, 'hour');
  const minutes = getPart(parts, 'minute');

  return `${year}-${month}-${day}T${hours}:${minutes}:00${CAMPUS_UTC_OFFSET}`;
}

function formatCampusTime(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: CAMPUS_TIME_ZONE,
  }).format(value);
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((part) => part.type === type)?.value ?? '';
}

function getCampusDateParts(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: CAMPUS_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(toDate(value));
}

function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}
