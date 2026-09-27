-- Apply AFTER schema.sql. All mutations go through authenticated server routes.
begin;
alter table campaigns add column if not exists sender_id uuid references sender_identities(id);
alter table email_queue add column if not exists next_attempt_at timestamptz default now();
alter table email_queue add column if not exists lease_token uuid;
alter table email_queue add column if not exists sent_at timestamptz;
create unique index if not exists queue_recipient_once on email_queue(campaign_id, recipient_email);
create unique index if not exists provider_message_unique on email_queue(provider_message_id) where provider_message_id is not null;
create unique index if not exists enrollment_once on automation_enrollments(automation_id,contact_id);
alter table automation_enrollments add column if not exists error_message text;
alter table automation_enrollments add column if not exists step_index integer not null default 0;
alter table automations add column if not exists next_run_at timestamptz;
alter table automations add column if not exists sender_id uuid references sender_identities(id);
create table if not exists import_contacts (
 import_id uuid references imports on delete cascade, contact_id uuid references contacts on delete cascade,
 source jsonb not null default '{}', primary key(import_id,contact_id)
);
create table if not exists campaign_recipients (
 campaign_id uuid references campaigns on delete cascade, contact_id uuid references contacts on delete cascade,
 primary key(campaign_id,contact_id)
);
create table if not exists delivery_logs (
 id uuid primary key default gen_random_uuid(), event_id text unique not null, provider_message_id text not null,
 event_type text not null, payload jsonb not null, created_at timestamptz default now(), processed_at timestamptz
);
create table if not exists user_settings (
 user_id uuid primary key references auth.users on delete cascade, send_rate integer not null default 1 check(send_rate between 1 and 10),
 timezone text not null default 'UTC', provider_key_encrypted text, next_send_at timestamptz default now()
);
create table if not exists api_limits (user_id uuid references auth.users on delete cascade, bucket text, window_start timestamptz, hits int not null default 1, primary key(user_id,bucket,window_start));
create table if not exists worker_locks (name text primary key, token uuid, expires_at timestamptz);
insert into worker_locks(name) values ('delivery') on conflict do nothing;

alter table import_contacts enable row level security;
alter table campaign_recipients enable row level security;
alter table delivery_logs enable row level security;
alter table user_settings enable row level security;
alter table api_limits enable row level security;
alter table worker_locks enable row level security;
create policy import_contacts_read on import_contacts for select using (exists(select 1 from imports i where i.id=import_id and i.user_id=auth.uid()));
create policy campaign_recipients_read on campaign_recipients for select using (exists(select 1 from campaigns c where c.id=campaign_id and c.user_id=auth.uid()));
-- Secrets and worker state have no browser grants or policies.
revoke all on user_settings, api_limits, worker_locks, delivery_logs from anon, authenticated;
revoke insert, update, delete on contacts,imports,campaigns,templates,email_queue,sender_identities,contact_groups,contact_group_members,automations,automation_steps,automation_enrollments,import_contacts,campaign_recipients from anon, authenticated;
drop policy if exists "Users can view own or starter templates" on templates;
create policy templates_read on templates for select using (user_id=auth.uid());

create or replace function import_recipients(p_user uuid, p_summary jsonb, p_recipients jsonb) returns uuid language plpgsql set search_path=public as $$
declare import_uuid uuid; item jsonb; contact_uuid uuid;
begin
 insert into imports(user_id,filename,total_rows,total_emails_detected,duplicates_removed,invalid_entries,blank_entries,unique_recipients,email_columns)
 values(p_user,p_summary->>'filename',(p_summary->>'totalRows')::int,(p_summary->>'totalEmailsDetected')::int,(p_summary->>'duplicatesRemoved')::int,(p_summary->>'invalidEmails')::int,(p_summary->>'blankCells')::int,jsonb_array_length(p_recipients),p_summary->'emailColumns') returning id into import_uuid;
 for item in select * from jsonb_array_elements(p_recipients) loop
  insert into contacts(user_id,email,source_import_id,source_sheet,source_row,source_column)
  values(p_user,item->>'email',import_uuid,item->'source'->>'sheet',(item->'source'->>'row')::int,item->'source'->>'column')
  on conflict(user_id,email) do nothing;
  select id into contact_uuid from contacts where user_id=p_user and email=item->>'email';
  insert into import_contacts values(import_uuid,contact_uuid,item->'source') on conflict do nothing;
  insert into automation_enrollments(automation_id,contact_id,next_action_at)
  select a.id,contact_uuid,now() from automations a where a.user_id=p_user and a.status='active' and a.trigger_type='contact_imported'
  and (coalesce(a.trigger_config->>'group_id','')='' or exists(select 1 from contact_group_members m where m.contact_id=contact_uuid and m.group_id::text=a.trigger_config->>'group_id'))
  on conflict(automation_id,contact_id) do nothing;
 end loop;
 return import_uuid;
end $$;

create or replace function save_campaign(p_user uuid,p_id uuid,p_data jsonb,p_contacts uuid[]) returns uuid language plpgsql set search_path=public as $$
declare c uuid;
begin
 if exists(select 1 from unnest(p_contacts) id where not exists(select 1 from contacts ct where ct.id=id and ct.user_id=p_user)) then raise exception 'Invalid recipient'; end if;
 if p_id is null then
  insert into campaigns(user_id,name,subject,from_name,body_html) values(p_user,p_data->>'name',p_data->>'subject',p_data->>'from_name',p_data->>'body_html') returning id into c;
 else
  select id into c from campaigns where id=p_id and user_id=p_user and status='draft' for update;
  if c is null then raise exception 'Only drafts can be edited'; end if;
 end if;
 update campaigns set name=p_data->>'name',subject=p_data->>'subject',from_name=p_data->>'from_name',reply_to=nullif(p_data->>'reply_to',''),body_html=p_data->>'body_html',body_text=p_data->>'body_text',sender_id=(p_data->>'sender_id')::uuid,attachments=coalesce(p_data->'attachments','[]'),total_recipients=cardinality(p_contacts) where id=c;
 delete from campaign_recipients where campaign_id=c;
 insert into campaign_recipients select c,unnest(p_contacts) on conflict do nothing;
 return c;
end $$;

create or replace function enqueue_campaign(p_user uuid,p_id uuid,p_schedule timestamptz default null) returns integer language plpgsql set search_path=public as $$
declare c campaigns; n int;
begin
 select * into c from campaigns where id=p_id and user_id=p_user for update;
 if c.id is null then raise exception 'Campaign not found'; end if;
 if c.status not in ('draft','scheduled') then return c.total_recipients; end if;
 if not exists(select 1 from sender_identities s where s.id=c.sender_id and s.user_id=p_user and s.verified) then raise exception 'A verified sender is required'; end if;
 if trim(c.subject)='' or trim(c.body_html)='' then raise exception 'Subject and body required'; end if;
 if not exists(select 1 from campaign_recipients r join contacts ct on ct.id=r.contact_id where r.campaign_id=p_id and ct.user_id=p_user and ct.status='active') then raise exception 'No active recipients'; end if;
 if p_schedule is not null then
  update campaigns set status='scheduled',scheduled_at=p_schedule where id=p_id; return c.total_recipients;
 end if;
 insert into email_queue(campaign_id,contact_id,recipient_email)
 select p_id,ct.id,ct.email from campaign_recipients r join contacts ct on ct.id=r.contact_id where r.campaign_id=p_id and ct.user_id=p_user and ct.status='active' on conflict do nothing;
 select count(*) into n from email_queue where campaign_id=p_id;
 if n=0 then raise exception 'No active recipients'; end if;
 update campaigns set status='sending',started_at=now(),total_recipients=n where id=p_id;
 return n;
end $$;

create or replace function take_api_limit(p_user uuid,p_bucket text,p_max int) returns boolean language plpgsql set search_path=public as $$
declare n int;
begin
 insert into api_limits values(p_user,p_bucket,date_trunc('hour',now()),1)
 on conflict(user_id,bucket,window_start) do update set hits=api_limits.hits+1 returning hits into n;
 return n<=p_max;
end $$;

create or replace function claim_email() returns setof email_queue language plpgsql set search_path=public as $$
declare q email_queue;
begin
 select e.* into q from email_queue e join campaigns c on c.id=e.campaign_id where c.status='sending' and
 ((e.status='queued' and e.next_attempt_at<=now()) or (e.status='sending' and e.attempted_at<now()-interval '10 minutes'))
 order by e.next_attempt_at,e.created_at for update of e skip locked limit 1;
 if q.id is null then return; end if;
 -- A retry outside the provider idempotency window must be reconciled manually.
 if q.status='sending' and q.attempted_at<now()-interval '23 hours' then
  update email_queue set status='failed',error_message='Delivery uncertain after extended outage; reconcile with provider before resending' where id=q.id; return;
 end if;
 return query update email_queue set status='sending',attempted_at=now(),lease_token=gen_random_uuid() where id=q.id returning *;
end $$;

create or replace function refresh_campaign(p_id uuid) returns void language sql set search_path=public as $$
 update campaigns c set
 sent_count=(select count(*) from email_queue where campaign_id=p_id and sent_at is not null),
 delivered_count=(select count(*) from email_queue where campaign_id=p_id and status='delivered'),
 failed_count=(select count(*) from email_queue where campaign_id=p_id and status='failed'),
 bounced_count=(select count(*) from email_queue where campaign_id=p_id and status='bounced'),
 status=case when exists(select 1 from email_queue where campaign_id=p_id and status in ('queued','sending')) then c.status when exists(select 1 from email_queue where campaign_id=p_id and sent_at is not null) then 'sent' else 'failed' end,
 completed_at=case when not exists(select 1 from email_queue where campaign_id=p_id and status in ('queued','sending')) then coalesce(completed_at,now()) else null end
 where c.id=p_id and c.status in ('sending','sent','failed');
$$;

create or replace function acquire_worker(p_token uuid) returns boolean language plpgsql set search_path=public as $$
begin
 update worker_locks set token=p_token,expires_at=now()+interval '5 minutes' where name='delivery' and (expires_at is null or expires_at<now());
 return found;
end $$;

-- All privileged RPCs are service-only, including future overloads of these functions.
do $$ declare f record; begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('import_recipients','save_campaign','enqueue_campaign','take_api_limit','claim_email','refresh_campaign','acquire_worker') loop
 execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('campaign-attachments','campaign-attachments',false,10485760,array['application/pdf','image/png','image/jpeg','text/plain','text/csv']) on conflict(id) do nothing;
-- Uploads/downloads use the server after ownership checks; no public storage policies.
create index if not exists queue_due on email_queue(next_attempt_at) where status='queued';
create index if not exists enrollments_due on automation_enrollments(next_action_at) where status='active';
commit;
