# Tenancy is an organization_id column on every row

All Organizations share one Postgres database; every table carries `organization_id` and every query goes through repository functions that require it. We rejected database-per-tenant (operationally heavy at hundreds of small groups) and schema-per-tenant (migration fan-out). Postgres row-level security will be layered on before the first multi-tenant production deployment as defence in depth.
