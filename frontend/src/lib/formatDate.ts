/** Formats a date for display as dd/mm/yyyy. Display-only — never use this
 * for the values sent to the API or to zod, which stay ISO (yyyy-mm-dd). */
export function formatDateDMY(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
