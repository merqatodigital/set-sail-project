-- ===========================================================================
-- TALA daily briefing — read from the operations tables, not cms_data
-- ===========================================================================
-- The operations_tables migration moved bookings/tours/staff/payments/etc.
-- out of cms_data.operations into their own admin-only tables. The app no
-- longer writes to cms_data.operations at all, so generate_tala_briefing()
-- (created in 20260723093000_tala_daily_briefing_cron.sql) would silently
-- start producing an all-zero briefing every morning if left as-is, since
-- it was reading `cms -> 'operations'` from the JSON blob.
--
-- This replaces the function body to query the relational tables directly.
-- Same math as before (mirrors OperationsDashboard.tsx); only the data
-- source changed. CREATE OR REPLACE — safe to re-run.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.generate_tala_briefing()
RETURNS public.tala_briefings AS $$
DECLARE
  today        TEXT  := to_char(now() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD');
  arrivals     INT;
  departures   INT;
  tour_today   INT;
  bikes_out    INT;
  in_house     INT;
  revenue_30   NUMERIC := 0;
  expenses_30  NUMERIC := 0;
  unpaid_pay   NUMERIC := 0;
  active_staff INT;
  highlights   TEXT[] := '{}';
  summary      TEXT;
  inserted     public.tala_briefings;
BEGIN
  SELECT count(*) INTO arrivals FROM public.bookings
    WHERE check_in = today AND status <> 'cancelled';
  SELECT count(*) INTO departures FROM public.bookings
    WHERE check_out = today AND status <> 'cancelled';
  SELECT count(*) INTO tour_today FROM public.tour_bookings
    WHERE date = today AND status <> 'cancelled';
  SELECT count(*) INTO bikes_out FROM public.motorbikes
    WHERE status = 'rented';
  SELECT count(*) INTO in_house FROM public.bookings
    WHERE status = 'checked_in';
  SELECT count(*) INTO active_staff FROM public.staff_members
    WHERE active IS TRUE;

  SELECT COALESCE(sum(amount), 0) INTO revenue_30
    FROM public.payments
    WHERE direction = 'in' AND date::timestamptz > now() - interval '30 days';
  SELECT COALESCE(sum(amount), 0) INTO expenses_30
    FROM public.payments
    WHERE direction = 'out' AND date::timestamptz > now() - interval '30 days';
  SELECT COALESCE(sum(amount), 0) INTO unpaid_pay
    FROM public.pay_records
    WHERE paid IS NOT TRUE;

  IF arrivals   > 0 THEN highlights := highlights || format('%s arrival(s) today', arrivals); END IF;
  IF departures > 0 THEN highlights := highlights || format('%s departure(s) today', departures); END IF;
  IF tour_today > 0 THEN highlights := highlights || format('%s tour(s) running', tour_today); END IF;
  IF bikes_out  > 0 THEN highlights := highlights || format('%s bike(s) out', bikes_out); END IF;
  IF in_house   > 0 THEN highlights := highlights || format('%s guest(s) in-house', in_house); END IF;
  IF unpaid_pay > 0 THEN highlights := highlights || format('Unpaid payroll: ₱%s', trim(to_char(unpaid_pay, 'FM999,999,999'))); END IF;
  IF revenue_30 > 0 THEN highlights := highlights || format('Revenue (30d): ₱%s', trim(to_char(revenue_30, 'FM999,999,999'))); END IF;
  IF expenses_30 > 0 THEN highlights := highlights || format('Expenses (30d): ₱%s', trim(to_char(expenses_30, 'FM999,999,999'))); END IF;

  summary := format('Good morning. Here is the rundown for %s. ', today);
  IF in_house > 0 THEN summary := summary || format('%s guest(s) are in-house. ', in_house);
  ELSE summary := summary || 'No guests are in-house right now. '; END IF;
  IF arrivals > 0 THEN summary := summary || format('%s arrival(s) expected today. ', arrivals);
  ELSE summary := summary || 'No arrivals scheduled today. '; END IF;
  IF departures > 0 THEN summary := summary || format('%s departure(s) today. ', departures);
  ELSE summary := summary || 'No departures today. '; END IF;
  IF tour_today > 0 THEN summary := summary || format('%s tour(s) on the schedule. ', tour_today);
  ELSE summary := summary || 'No tours booked today. '; END IF;
  IF bikes_out > 0 THEN summary := summary || format('%s motorbike(s) out. ', bikes_out); END IF;
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
