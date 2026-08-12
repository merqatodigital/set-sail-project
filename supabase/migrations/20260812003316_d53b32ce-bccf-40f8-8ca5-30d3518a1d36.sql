GRANT SELECT ON public.tala_leads TO anon;
GRANT SELECT ON public.tala_audit_log TO anon;
CREATE POLICY "Demo visitors can read leads" ON public.tala_leads FOR SELECT TO anon USING (true);
CREATE POLICY "Demo visitors can read audit log" ON public.tala_audit_log FOR SELECT TO anon USING (true);