-- Migration 032 — bucket company-docs (RIB, KBIS, attestations entreprise)
--
-- Bucket prive (PDF + images, max 5 MB) pour documents administratifs
-- de l'entreprise. RLS : admin-only (lecture / ecriture / suppression).
--
-- Applique le 2026-05-06 via mcp__supabase__apply_migration.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-docs',
  'company-docs',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = EXCLUDED.public;

CREATE POLICY "company-docs admin select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-docs' AND public.is_admin());

CREATE POLICY "company-docs admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-docs' AND public.is_admin());

CREATE POLICY "company-docs admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-docs' AND public.is_admin())
  WITH CHECK (bucket_id = 'company-docs' AND public.is_admin());

CREATE POLICY "company-docs admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-docs' AND public.is_admin());
