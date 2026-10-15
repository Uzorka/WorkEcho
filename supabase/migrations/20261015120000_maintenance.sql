-- Slice 7: daily data clean-up (retention).
--
-- One function, run once a day by the Vercel cron job (/api/cron/maintenance)
-- with the service-role key. Nobody else can call it. It deletes or unlinks
-- data we no longer need, matching the periods on the privacy page:
--
--   posting-limit timestamps ........ deleted after 2 days (longest limit window is 1 day)
--   verification code attempts ...... deleted after 7 days (codes expire after 15 minutes)
--   alerts .......................... read ones deleted after 90 days, all after 1 year
--   closed reports .................. reporter unlinked 12 months after closing
--   handled company requests ........ requester unlinked 12 months after creation
--   verifications ................... past their expiry date are marked expired
--
-- Published content, moderation decisions (admin_actions) and verification
-- records are kept; see the privacy page.

create function public.run_maintenance() returns jsonb
  language plpgsql security definer set search_path = ''
as $$
declare
  n_rate int;
  n_challenges int;
  n_notifications int;
  n_reports int;
  n_requests int;
  n_expired int;
begin
  delete from public.rate_limit_events where created_at < now() - interval '2 days';
  get diagnostics n_rate = row_count;

  delete from public.verification_challenges where created_at < now() - interval '7 days';
  get diagnostics n_challenges = row_count;

  delete from public.notifications
   where (is_read and created_at < now() - interval '90 days')
      or created_at < now() - interval '1 year';
  get diagnostics n_notifications = row_count;

  update public.reports set reporter_id = null
   where reporter_id is not null
     and status <> 'open'
     and coalesce(resolved_at, created_at) < now() - interval '12 months';
  get diagnostics n_reports = row_count;

  update public.company_requests set requester_id = null
   where requester_id is not null
     and status <> 'pending'
     and created_at < now() - interval '12 months';
  get diagnostics n_requests = row_count;

  update public.verifications set status = 'expired'
   where status = 'active' and expires_at <= now();
  get diagnostics n_expired = row_count;

  -- Counts only: no ids, so this is safe to log.
  return jsonb_build_object(
    'rate_limit_events_deleted', n_rate,
    'verification_challenges_deleted', n_challenges,
    'notifications_deleted', n_notifications,
    'reports_unlinked', n_reports,
    'company_requests_unlinked', n_requests,
    'verifications_expired', n_expired
  );
end;
$$;

revoke all on function public.run_maintenance() from public, anon, authenticated;
grant execute on function public.run_maintenance() to service_role;
