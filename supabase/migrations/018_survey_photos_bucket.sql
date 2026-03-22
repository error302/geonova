-- Survey photos storage bucket for report field photographs
insert into storage.buckets (id, name, public)
values ('survey_photos', 'survey_photos', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload photos"
on storage.objects for insert
with check (bucket_id = 'survey_photos' and auth.role() = 'authenticated');

create policy "Users can read own photos"
on storage.objects for select
using (bucket_id = 'survey_photos' and auth.uid()::text = (storage.foldername(name))[1]);
