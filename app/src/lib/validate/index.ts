// app/src/lib/validate/index.ts
import type { Draft, Validation } from './model';
import { runAllChecks } from './checks';

/** Very first stub: totals only vehicle count, no cans logic */
export async function validateDraft(draft: Draft): Promise<Validation> {
  const vehicleReports = draft.vehicles.map(v => ({
    vehicleId: v.id,
    cans: 0,
    errors: []
  }));

  const report: Validation = {
    cans: 0,
    errors: [],
    vehicleReports
  };

  runAllChecks(report);      // currently does nothing
  return report;
}

