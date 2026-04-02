-- Make material minimum stock optional for low-stock monitoring opt-in.
ALTER TABLE "Material"
  ALTER COLUMN "minStock" DROP DEFAULT,
  ALTER COLUMN "minStock" DROP NOT NULL;
