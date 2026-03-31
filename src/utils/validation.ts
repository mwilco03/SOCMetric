export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidDate(date: string): boolean {
  const d = new Date(date);
  return !isNaN(d.getTime());
}

export function isValidJiraDomain(domain: string): boolean {
  return /^[a-z0-9-]+\.atlassian\.net$/i.test(domain);
}

export function sanitizeString(input: string): string {
  return input.replace(/[<>"']/g, '');
}

export function validateRequired(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null || value === '') {
    return `${fieldName} is required`;
  }
  return null;
}

export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): string | null {
  if (value < min || value > max) {
    return `${fieldName} must be between ${min} and ${max}`;
  }
  return null;
}

