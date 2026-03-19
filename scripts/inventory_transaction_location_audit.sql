SELECT
  id,
  "locationFromType",
  "locationToType",
  "locationFromJobId",
  "locationToJobId"
FROM "InventoryTransaction"
WHERE
  ("locationFromType" IS NOT NULL AND UPPER(BTRIM("locationFromType"::text)) NOT IN ('SHOP', 'JOB'))
  OR ("locationToType" IS NOT NULL AND UPPER(BTRIM("locationToType"::text)) NOT IN ('SHOP', 'JOB'))
  OR ("locationFromType"::text = 'SHOP' AND "locationFromJobId" IS NOT NULL)
  OR ("locationToType"::text = 'SHOP' AND "locationToJobId" IS NOT NULL)
  OR ("locationFromType"::text = 'JOB' AND "locationFromJobId" IS NULL)
  OR ("locationToType"::text = 'JOB' AND "locationToJobId" IS NULL)
ORDER BY "createdAt" DESC, id;
