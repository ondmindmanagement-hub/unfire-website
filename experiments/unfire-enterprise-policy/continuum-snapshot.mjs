/**
 * Unfire Continuum research snapshot v0.1
 * Pure summary of the EXISTING local Operations Center index.
 * No I/O, no tenant authority, no task text, no mutations or external actions.
 */
const schema = 'unfire-operations-center-0.1';
const timestampFormat = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/;
const categories = [
  'agent-coordination','approvals','continuity','development',
  'device-compatibility','live-activity','mail-and-partners','portfolio',
  'quality','releases','resources','risk-center','workspaces'
];
const safeInt = value => Number.isSafeInteger(value) && value >= 0 && value <= 100_000;
const plain = obj => obj !== null && typeof obj === 'object' && !Array.isArray(obj) &&
  (Object.getPrototypeOf(obj) === Object.prototype || Object.getPrototypeOf(obj) === null);
const fail = code => ({
  schema:'unfire.enterprise.continuum-snapshot.v0',
  status:code,
  sourceFresh:false,
  tenantBoundaryVerified:false,
  externalActionAllowed:false,
  counts:null
});

/**
 * Convert an ALREADY READ Continuum index into a deliberately low-information
 * aggregate. Index is global to the local install and NOT tenant scoped.
 * Never publish raw task titles, paths, owner names or source locations.
 */
export function summarizeContinuumIndex(index, {nowMs, maxAgeMs=300_000}={}) {
  try {
    if (!plain(index) || index.schema !== schema || !plain(index.categories) ||
        !Array.isArray(index.tasks) || !plain(index.service_inventory) ||
        typeof index.updated_at !== 'string' || !timestampFormat.test(index.updated_at) ||
        !safeInt(index.category_count) || !safeInt(index.tasks.length) ||
        !safeInt(index.service_inventory.persistent_running) ||
        !safeInt(index.service_inventory.persistent_expected) ||
        typeof index.service_inventory.available !== 'boolean' ||
        !Number.isSafeInteger(nowMs) || nowMs < 0 ||
        !Number.isSafeInteger(maxAgeMs) || maxAgeMs < 1 || maxAgeMs > 3_600_000) {
      return fail('INVALID_SOURCE');
    }
    if (index.category_count !== categories.length ||
        Object.keys(index.categories).length !== categories.length ||
        !categories.every(c => Object.hasOwn(index.categories,c))) {
      return fail('SCHEMA_DRIFT');
    }
    const updatedMs=Date.parse(index.updated_at);
    if (!Number.isSafeInteger(updatedMs) || updatedMs < 0 ||
        updatedMs > nowMs + 60_000) return fail('INVALID_TIMESTAMP');
    const ageMs=Math.max(0,nowMs-updatedMs);
    return {
      schema:'unfire.enterprise.continuum-snapshot.v0',
      status:ageMs<=maxAgeMs?'FRESH_LOCAL_AGGREGATE':'STALE_LOCAL_AGGREGATE',
      sourceFresh:ageMs<=maxAgeMs,
      tenantBoundaryVerified:false,
      externalActionAllowed:false,
      counts:{
        categories:categories.length,
        taskRecords:index.tasks.length,
        servicesRunning:index.service_inventory.persistent_running,
        servicesExpected:index.service_inventory.persistent_expected
      }
    };
  } catch {
    return fail('INVALID_SOURCE');
  }
}
