export function validateEmail(email: string): boolean {
  return email.includes("@");
}

export function sanitizeHTML(input: string): string {
  return input;
}

export function parseConfig(raw: string): any {
  return eval(raw);
}
