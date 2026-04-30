/**
 * WFM import config.
 *
 * Edit this file to control which jobs (and dependent rows) are
 * pulled from staging into the live app tables during Stage 2.
 *
 * Used by the transform script (not by the loader -- the loader
 * always loads everything in the CSVs into staging).
 */

module.exports = {
  // ── Date filter ──────────────────────────────────────────────
  // Only import jobs with [Job] Date Created on/after this date.
  // Set to null to disable the date filter and rely entirely on
  // alwaysIncludeJobNumbers.
  cutoffDate: '2023-01-01',

  // ── Always include (overrides) ──────────────────────────────
  // Job numbers that must be imported regardless of cutoffDate.
  // Use this for old jobs that are still active.
  alwaysIncludeJobNumbers: [
    // '17668',
    // '15220',
  ],

  // ── Always exclude ──────────────────────────────────────────
  // Job numbers that must NOT be imported even if they pass the
  // cutoff filter. Use for internal admin jobs, test jobs, etc.
  alwaysExcludeJobNumbers: [
    // 'INTERNAL',
  ],

  // ── Cascading rules (informational) ──────────────────────────
  // The transform follows these automatically:
  //   * A client is imported only if it owns >=1 imported job.
  //   * Time entries are imported only if their job is imported.
  //   * Invoices are imported only if all their job numbers are
  //     imported. (Multi-job invoices with mixed inclusion are
  //     flagged as warnings.)
};
