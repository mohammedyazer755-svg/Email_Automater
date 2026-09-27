begin;
alter table email_queue add column if not exists first_attempt_at timestamptz;
update email_queue set first_attempt_at=coalesce(attempted_at,created_at) where first_attempt_at is null and (status='sending' or retry_count>0);
create or replace function claim_email() returns setof email_queue language plpgsql set search_path=public as $$
declare q email_queue;
begin
 select e.* into q from email_queue e join campaigns c on c.id=e.campaign_id where c.status='sending' and
 ((e.status='queued' and e.next_attempt_at<=now()) or (e.status='sending' and e.attempted_at<now()-interval '10 minutes'))
 order by e.next_attempt_at,e.created_at for update of e skip locked limit 1;
 if q.id is null then return; end if;
 if q.first_attempt_at<now()-interval '23 hours' then
  update email_queue set status='failed',error_message='Delivery uncertain after extended outage; reconcile with provider before resending' where id=q.id;
  perform refresh_campaign(q.campaign_id); return;
 end if;
 return query update email_queue set status='sending',attempted_at=now(),first_attempt_at=coalesce(first_attempt_at,now()),lease_token=gen_random_uuid() where id=q.id returning *;
end $$;
create or replace function reconcile_delivery_events() returns integer language plpgsql set search_path=public as $$
declare e record; n int=0;
begin
 for e in select l.event_id from delivery_logs l join email_queue q on q.provider_message_id=l.provider_message_id join campaigns c on c.id=q.campaign_id and c.user_id=l.owner_id where l.processed_at is null order by l.created_at limit 200 loop
 perform apply_delivery_event(e.event_id); n=n+1;
 end loop;
 delete from delivery_logs where created_at<now()-interval '90 days';
 delete from api_limits where window_start<now()-interval '2 days';
 return n;
end $$;
create or replace function seed_user_templates() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into templates(user_id,name,category,subject,body_html,is_starter) values
 (new.id,'Event Registration Confirmation','confirmation','Your registration is confirmed','<h1>You are registered!</h1><p>Thank you for registering. We look forward to welcoming you.</p>',true),
 (new.id,'Event Reminder','reminder','Our event is in two days','<h1>See you soon</h1><p>Please check your registration details and arrive a few minutes early.</p>',true),
 (new.id,'Team Selection Announcement','announcement','Welcome to the team','<h1>Congratulations!</h1><p>You have been selected to join our team.</p>',true),
 (new.id,'Payment Confirmation','confirmation','Payment received','<h1>Thank you</h1><p>We have received your payment. Keep your receipt for your records.</p>',true),
 (new.id,'Certificate Distribution','certificate','Your certificate is ready','<h1>Well done!</h1><p>Your certificate is attached to this email.</p>',true);
 return new;
end $$;
create trigger seed_templates_after_signup after insert on auth.users for each row execute function seed_user_templates();
revoke all on function reconcile_delivery_events(),seed_user_templates(),claim_email() from public,anon,authenticated;
grant execute on function reconcile_delivery_events(),claim_email() to service_role;
commit;
