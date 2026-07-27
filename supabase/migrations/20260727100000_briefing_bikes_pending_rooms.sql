-- ===========================================================================
-- TALA daily briefing — bike readiness, pending bookings, and open rooms
-- ===========================================================================
-- Follow-up to 20260727090000: the admin console's live "Right now" panel
-- and computeBriefing() (src/components/tala/buildTalaBriefing.ts) now
-- surface bike availability/maintenance, bookings awaiting confirmation, and
-- which room types have nobody booked in tonight. This brings the pg_cron
-- generated briefing (the one that lands in Admin -> TALA -> Morning Brief
-- automatically every day at 7am Asia/Manila, no click needed) up to the
-- same level of detail, so the stored briefing text matches what you see
-- live in the console.
--
-- Room-type "open tonight" is intentionally left OUT of the stored SQL
-- briefing: it needs the room catalog from cms_data.homepage.rooms (name +
-- visibility), which is JSON matched against room_type text on bookings —
-- fragile to do reliably in plpgsql. It stays a live, always-fresh
-- calculation in the admin console (computeBriefing) instead.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.generate_tala_briefing()
RETURNS public.tala_briefings AS $$
DECLARE
  today          TEXT  := to_char(now() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD');
  arrivals       INT;
  departures     INT;
  tour_today     INT;
  bikes_out      INT;
  bikes_available INT;
  bikes_maint    INT;
  pending_bookings INT;
  in_house       INT;
  revenue_30     NUMERIC := 0;
  expenses_30    NUMERIC := 0;
  unpaid_pay     NUMERIC := 0;
  active_staff   INT;
  highlights     TEXT[] := '{}';
  summary        TEXT;
  inserted       public.tala_briefings;
BEGIN
  SELECT count(*) INTO arrivals FROM public.bookings WHERE check_in = today AND status <> 'cancelled';
  SELECT count(*) INTO departures FROM public.bookings WHERE check_out = today AND status <> 'cancelled';
  SELECT count(*) INTO tour_today FROM public.tour_bookings WHERE date = today AND status <> 'cancelled';
  SELECT count(*) INTO bikes_out FROM public.motorbikes WHERE status = 'rented';
  SELECT count(*) INTO bikes_available FROM public.motorbikes WHERE active IS TRUE AND status = 'available';
  SELECT count(*) INTO bikes_maint FROM public.motorbikes WHERE status = 'maintenance';
  SELECT count(*) INTO pending_bookings FROM public.bookings WHERE status = 'pending';
  SELECT count(*) INTO in_house FROM public.bookings WHERE status = 'checked_in';
  SELECT count(*) INTO active_staff FROM public.staff_members WHERE active IS TRUE;

  SELECT COALESCE(sum(amount), 0) INTO revenue_30 FROM public.payments
    WHERE direction = 'in' AND date::timestamptz > now() - interval '30 days';
  SELECT COALESCE(sum(amount), 0) INTO expenses_30 FROM public.payments
    WHERE direction = 'out' AND date::timestamptz > now() - interval '30 days';
  SELECT COALESCE(sum(amount), 0) INTO unpaid_pay FROM public.pay_records WHERE paid IS NOT TRUE;

  IF arrivals         > 0 THEN highlights := highlights || format('%s arrival(s) today', arrivals); END IF;
  IF departures       > 0 THEN highlights := highlights || format('%s departure(s) today', departures); END IF;
  IF tour_today       > 0 THEN highlights := highlights || format('%s tour(s) running', tour_today); END IF;
  IF bikes_out        > 0 THEN highlights := highlights || format('%s bike(s) out', bikes_out); END IF;
  IF bikes_available  > 0 THEN highlights := highlights || format('%s bike(s) ready to rent', bikes_available); END IF;
  IF bikes_maint      > 0 THEN highlights := highlights || format('%s bike(s) in maintenance', bikes_maint); END IF;
  IF pending_bookings > 0 THEN highlights := highlights || format('%s booking(s) awaiting confirmation', pending_bookings); END IF;
  IF in_house         > 0 THEN highlights := highlights || format('%s guest(s) in-house', in_house); END IF;
  IF unpaid_pay       > 0 THEN highlights := highlights || format('Unpaid payroll: ₱%s', trim(to_char(unpaid_pay, 'FM999,999,999'))); END IF;
  IF revenue_30       > 0 THEN highlights := highlights || format('Revenue (30d): ₱%s', trim(to_char(revenue_30, 'FM999,999,999'))); END IF;
  IF expenses_30      > 0 THEN highlights := highlights || format('Expenses (30d): ₱%s', trim(to_char(expenses_30, 'FM999,999,999'))); END IF;

  summary := format('Good morning. Here is the rundown for %s. ', today);
  IF in_house > 0 THEN summary := summary || format('%s guest(s) are in-house. ', in_house); ELSE summary := summary || 'No guests are in-house right now. '; END IF;
  IF arrivals > 0 THEN summary := summary || format('%s arrival(s) expected today. ', arrivals); ELSE summary := summary || 'No arrivals scheduled today. '; END IF;
  IF departures > 0 THEN summary := summary || format('%s departure(s) today. ', departures); ELSE summary := summary || 'No departures today. '; END IF;
  IF pending_bookings > 0 THEN summary := summary || format('%s booking(s) are waiting on your confirmation. ', pending_bookings); END IF;
  IF tour_today > 0 THEN summary := summary || format('%s tour(s) on the schedule. ', tour_today); ELSE summary := summary || 'No tours booked today. '; END IF;
  IF bikes_out > 0 OR bikes_available > 0 THEN
    summary := summary || format('Bikes: %s out, %s ready to rent%s. ',
      bikes_out, bikes_available,
      CASE WHEN bikes_maint > 0 THEN format(', %s in maintenance', bikes_maint) ELSE '' END);
  END IF;
  IF revenue_30 > 0 OR expenses_30 > 0 THEN
    summary := summary || format('Last 30 days: ₱%s in, ₱%s out. ',
      trim(to_char(revenue_30, 'FM999,999,999')), trim(to_char(expenses_30, 'FM999,999,999')));
  END IF;
  IF unpaid_pay > 0 THEN summary := summary || format('Heads up — ₱%s in payroll is still unpaid. ', trim(to_char(unpaid_pay, 'FM999,999,999'))); END IF;
  summary := summary || format('%s staff active.', active_staff);

  INSERT INTO public.tala_briefings (brief_date, summary, highlights)
  VALUES (today, summary, to_jsonb(highlights))
  RETURNING * INTO inserted;

  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.generate_tala_briefing() TO postgres, service_role;

-- ---------------------------------------------------------------------------
-- Verification — confirm the daily job is actually scheduled (it was created
-- in 20260723093000_tala_daily_briefing_cron.sql; this just re-checks it's
-- still there after any project pause/restore, since pg_cron jobs can be
-- lost on some plan changes). Run this SELECT after applying the block above:
-- ---------------------------------------------------------------------------
-- select jobname, schedule, active from cron.job where jobname = 'tala_daily_briefing';
-- Expect one row: schedule '0 23 * * *' (07:00 Asia/Manila), active = true.
-- If no row comes back, run this to (re)create it:
--
-- select cron.schedule('tala_daily_briefing', '0 23 * * *', 'SELECT public.generate_tala_briefing();');
