import { Client } from '../types';

/**
 * Single source of truth for "has this client's report been marked done?".
 *
 * Status is stored on `clients.report_done_month` as a 'YYYY-MM' stamp rather than a
 * boolean, and is always compared against the *current* month. That means the status
 * resets by itself on the 1st of every month — a stamp from a previous month, or no
 * stamp at all, reads as Pending without anything having to clear the column.
 *
 * Both the sidebar status dot and the "Mark as Done" button derive from these helpers,
 * so the two can never disagree.
 */

/** Current month as the 'YYYY-MM' stamp written to `report_done_month` (local time). */
export function currentReportMonth(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** True only when the client's report was marked done during the current calendar month. */
export function isReportDoneThisMonth(
  client: Pick<Client, 'report_done_month'> | null | undefined
): boolean {
  if (!client?.report_done_month) return false;
  return client.report_done_month === currentReportMonth();
}
