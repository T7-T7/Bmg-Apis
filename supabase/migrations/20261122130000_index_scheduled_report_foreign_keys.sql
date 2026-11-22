create index if not exists report_runs_template_id_idx
  on public.report_runs(template_id) where template_id is not null;
create index if not exists report_runs_created_by_idx
  on public.report_runs(created_by) where created_by is not null;
create index if not exists report_templates_created_by_idx
  on public.report_templates(created_by) where created_by is not null;