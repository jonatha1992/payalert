CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  p_key text NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 1),
  PRIMARY KEY (p_key, window_started_at)
);

CREATE INDEX IF NOT EXISTS rate_limit_counters_window_started_at_idx
  ON public.rate_limit_counters (window_started_at);

CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_key text,
  p_window_seconds integer,
  p_limit integer
)
RETURNS TABLE (allowed boolean, remaining integer, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_window_epoch bigint;
  v_window_start timestamptz;
  v_count integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_key IS NULL OR p_window_seconds < 1 OR p_limit < 1 THEN
    RAISE EXCEPTION 'invalid rate limit parameters';
  END IF;

  v_window_epoch := floor(extract(epoch FROM v_now) / p_window_seconds)::bigint;
  v_window_start := to_timestamp(v_window_epoch * p_window_seconds);

  INSERT INTO public.rate_limit_counters AS counters (p_key, window_started_at, request_count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (p_key, window_started_at)
  DO UPDATE SET request_count = counters.request_count + 1
  RETURNING counters.request_count INTO v_count;

  RETURN QUERY SELECT
    v_count <= p_limit,
    greatest(0, p_limit - v_count),
    greatest(1, ceil(extract(epoch FROM (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::integer);
END;
$$;

REVOKE ALL ON TABLE public.rate_limit_counters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.rate_limit_counters TO service_role;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;
