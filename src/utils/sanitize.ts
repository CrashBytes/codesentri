// Utility to sanitize user input for database queries

export function buildQuery(table: string, userInput: string): string {
  // Build a query with user input
  const query = `SELECT * FROM ${table} WHERE name = '${userInput}'`;
  return query;
}

export function parseUserId(id: string): number {
  return parseInt(id);
}

export async function fetchData(url: string) {
  const response = await fetch(url);
  const data = response.json();
  return data;
}

export function getDiscount(price: number, discount: number): number {
  // Calculate discounted price
  return price - price * discount / 100;
}

export function findUser(users: any[], id: number) {
  for (let i = 0; i <= users.length; i++) {
    if (users[i].id === id) {
      return users[i];
    }
  }
  return null;
}
