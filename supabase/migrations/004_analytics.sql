begin;
create or replace function analytics_report(p_user uuid,p_since timestamptz default null) returns jsonb language sql stable set search_path=public as $$
 with c as (select * from campaigns where user_id=p_user and (p_since is null or created_at>=p_since)),
 e as (select e.* from email_queue e join campaigns c on c.id=e.campaign_id where c.user_id=p_user and (p_since is null or coalesce(e.sent_at,e.created_at)>=p_since)),
 daily as (select to_char(sent_at at time zone 'UTC','YYYY-MM-DD') as date,count(*) as sent from e where sent_at is not null group by 1 order by 1),
 statuses as (select status,count(*) as value from e group by status)
 select jsonb_build_object(
 'contacts',(select count(*) from contacts where user_id=p_user),
 'campaigns',(select count(*) from c),
 'sent',(select count(*) from e where sent_at is not null),
 'delivered',(select count(*) from e where status='delivered'),
 'failed',(select count(*) from e where status in ('failed','bounced','complained')),
 'success_rate',coalesce((select round(100.0*count(*) filter(where status in ('sent','delivered'))/nullif(count(*) filter(where status not in ('queued','sending','skipped')),0),1) from e),0),
 'timeline',coalesce((select jsonb_agg(daily) from daily),'[]'),
 'statuses',coalesce((select jsonb_agg(statuses) from statuses),'[]'),
 'top',coalesce((select jsonb_agg(t) from (select id,name,total_recipients,sent_count,failed_count,status,created_at from c order by total_recipients desc limit 10)t),'[]'),
 'recent',coalesce((select jsonb_agg(t) from (select id,name,total_recipients,sent_count,failed_count,status,created_at from c order by created_at desc limit 5)t),'[]'),
 'activity',coalesce((select jsonb_agg(t) from (select * from (select id,name as title,'campaign' as type,created_at from campaigns where user_id=p_user union all select id,filename,'import',created_at from imports where user_id=p_user)a order by created_at desc limit 10)t),'[]')
 );
$$;
revoke all on function analytics_report(uuid,timestamptz) from public,anon,authenticated;
grant execute on function analytics_report(uuid,timestamptz) to service_role;
commit;
