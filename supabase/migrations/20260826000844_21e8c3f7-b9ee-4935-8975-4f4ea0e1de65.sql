GRANT UPDATE, DELETE ON public.tala_knowledge TO anon;
GRANT UPDATE, DELETE ON public.tala_knowledge TO authenticated;

CREATE POLICY "Public can update tala knowledge"
ON public.tala_knowledge
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Public can delete tala knowledge"
ON public.tala_knowledge
FOR DELETE
TO anon, authenticated
USING (true);