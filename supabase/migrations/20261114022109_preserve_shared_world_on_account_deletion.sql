
ALTER TABLE public.golden_world_chunks
  ALTER COLUMN updated_by DROP NOT NULL;

ALTER TABLE public.golden_world_chunks
  DROP CONSTRAINT IF EXISTS golden_world_chunks_updated_by_fkey;

ALTER TABLE public.golden_world_chunks
  ADD CONSTRAINT golden_world_chunks_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
