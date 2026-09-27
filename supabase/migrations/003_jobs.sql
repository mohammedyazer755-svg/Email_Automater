begin;
alter table user_settings add column if not exists webhook_secret_encrypted text;
alter table delivery_logs add column if not exists owner_id uuid references auth.users on delete cascade;
create or replace function duplicate_campaign(p_user uuid,p_id uuid) returns uuid language plpgsql set search_path=public as $$
declare new_id uuid;
begin
 insert into campaigns(user_id,name,subject,from_name,reply_to,body_html,body_text,sender_id,attachments,total_recipients)
 select user_id,name||' (copy)',subject,from_name,reply_to,body_html,body_text,sender_id,attachments,total_recipients from campaigns where id=p_id and user_id=p_user returning id into new_id;
 if new_id is null then raise exception 'Not found'; end if;
 insert into campaign_recipients select new_id,contact_id from campaign_recipients where campaign_id=p_id;
 return new_id;
end $$;
create or replace function default_sender(p_user uuid,p_id uuid) returns void language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if not exists(select 1 from sender_identities where id=p_id and user_id=p_user) then raise exception 'Not found'; end if;
 update sender_identities set is_default=(id=p_id) where user_id=p_user;
end $$;
create or replace function save_automation(p_user uuid,p_id uuid,p_data jsonb) returns uuid language plpgsql set search_path=public as $$
declare a uuid; s jsonb; n int=0;
begin
 if p_id is null then insert into automations(user_id,name,trigger_type) values(p_user,p_data->>'name',p_data->>'trigger_type') returning id into a;
 else select id into a from automations where id=p_id and user_id=p_user and status='draft' for update; end if;
 if a is null then raise exception 'Only drafts can be edited'; end if;
 update automations set name=p_data->>'name',description=p_data->>'description',trigger_type=p_data->>'trigger_type',trigger_config=p_data->'trigger_config',sender_id=(p_data->>'sender_id')::uuid where id=a;
 delete from automation_steps where automation_id=a;
 for s in select * from jsonb_array_elements(p_data->'steps') loop
 insert into automation_steps(automation_id,step_order,step_type,config) values(a,n,s->>'step_type',s->'config'); n=n+1;
 end loop;
 return a;
end $$;
-- One enrollment step and any resulting campaign are committed together.
create or replace function advance_automation(p_id uuid) returns void language plpgsql set search_path=public as $$
declare e automation_enrollments; a automations; s automation_steps; ct contacts; t templates; sender sender_identities; c uuid; next_at timestamptz=now();
begin
 select * into e from automation_enrollments where id=p_id and status='active' and next_action_at<=now() for update skip locked;
 if e.id is null then return; end if;
 select * into a from automations where id=e.automation_id and status='active';
 if a.id is null then return; end if;
 select * into ct from contacts where id=e.contact_id and user_id=a.user_id;
 if ct.id is null or ct.status<>'active' then update automation_enrollments set status='exited' where id=e.id; return; end if;
 select * into s from automation_steps where automation_id=a.id and step_order=e.step_index;
 if s.id is null then update automation_enrollments set status='completed',next_action_at=null where id=e.id; return; end if;
 if s.step_type='wait' then next_at=now()+make_interval(secs => (s.config->>'duration_hours')::double precision*3600);
 elsif s.step_type='condition' then
  if ((ct.status=s.config->>'status')<>(coalesce(s.config->>'operator','equals')='equals')) then update automation_enrollments set status='exited' where id=e.id; return; end if;
 elsif s.step_type='send_email' then
  select * into t from templates where id=(s.config->>'template_id')::uuid and user_id=a.user_id;
  select * into sender from sender_identities where id=a.sender_id and user_id=a.user_id and verified;
  if t.id is null or sender.id is null then raise exception 'Template or verified sender missing'; end if;
  insert into campaigns(user_id,name,subject,body_html,body_text,from_name,reply_to,sender_id,total_recipients)
  values(a.user_id,a.name||' / step '||(e.step_index+1),coalesce(nullif(s.config->>'subject_override',''),t.subject),t.body_html,t.body_text,sender.from_name,sender.reply_to,sender.id,1) returning id into c;
  insert into campaign_recipients values(c,ct.id);
  perform enqueue_campaign(a.user_id,c,null);
 end if;
 update automation_enrollments set step_index=step_index+1,current_step_id=(select id from automation_steps where automation_id=a.id and step_order=e.step_index+1),next_action_at=next_at,error_message=null where id=e.id;
end $$;
create or replace function enroll_scheduled(p_id uuid,p_next timestamptz) returns void language plpgsql set search_path=public as $$
declare a automations;
begin
 select * into a from automations where id=p_id and status='active' and next_run_at<=now() for update skip locked;
 if a.id is null then return; end if;
 insert into automation_enrollments(automation_id,contact_id,next_action_at)
 select a.id,c.id,now() from contacts c where c.user_id=a.user_id and c.status='active' and (coalesce(a.trigger_config->>'group_id','')='' or exists(select 1 from contact_group_members m where m.contact_id=c.id and m.group_id::text=a.trigger_config->>'group_id')) on conflict(automation_id,contact_id) do nothing;
 update automations set next_run_at=p_next where id=a.id;
end $$;

create or replace function apply_delivery_event(p_event text) returns boolean language plpgsql set search_path=public as $$
declare event delivery_logs; q email_queue; new_status text;
begin
 select * into event from delivery_logs where event_id=p_event and processed_at is null for update;
 if event.id is null then return true; end if;
 select e.* into q from email_queue e join campaigns c on c.id=e.campaign_id where e.provider_message_id=event.provider_message_id and c.user_id=event.owner_id for update of e;
 if q.id is null then return false; end if;
 new_status=case event.event_type when 'email.delivered' then 'delivered' when 'email.bounced' then 'bounced' when 'email.complained' then 'complained' when 'email.failed' then 'failed' else null end;
 -- Terminal suppression events outrank delayed delivery events.
 if new_status is not null and (q.status not in ('bounced','complained') or new_status='complained') then
 update email_queue set status=new_status,delivered_at=case when new_status='delivered' then event.created_at else delivered_at end,error_message=case when new_status in ('failed','bounced','complained') then event.event_type else error_message end where id=q.id;
 end if;
 if new_status in ('bounced','complained') then
 update contacts set status=case when new_status='complained' then 'unsubscribed' else 'bounced' end
 where id=q.contact_id and (new_status='complained' or status<>'unsubscribed');
 end if;
 update delivery_logs set processed_at=now() where id=event.id;
 perform refresh_campaign(q.campaign_id);
 return true;
end $$;
do $$ declare f record; begin
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname in ('duplicate_campaign','default_sender','save_automation','advance_automation','enroll_scheduled','apply_delivery_event') loop
 execute format('revoke all on function %s from public, anon, authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
