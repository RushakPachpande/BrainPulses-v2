/**
 * Force a create row onto the request organization.
 * A foreign organizationId must throw. Spreading the row after the injected
 * id would let createMany keep the foreign value and skip the throw.
 */
export function withTenantOrganization(
  model: string,
  row: Record<string, unknown>,
  organizationId: string,
): Record<string, unknown> {
  if ('organizationId' in row && row.organizationId !== organizationId) {
    throw new Error(`Tenant scope mismatch on ${model} create`);
  }
  return { ...row, organizationId };
}
