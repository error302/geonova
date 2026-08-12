/**
 * Wrap mock rows into a pg QueryResult-like shape for `db.query` mocks.
 *
 * `rowCount` defaults to the row length; pass it explicitly when the route
 * under test inspects `result.rowCount` (e.g. a successful UPDATE reports
 * 1 row while the SELECTs return 0).
 */
export function mr<T>(rows: T[], rowCount = rows.length) {
  return {
    rows,
    command: '' as const,
    rowCount,
    oid: 0 as const,
    fields: [] as Array<never>,
  }
}
