-- ============================================================
-- POD Platform — Database Schema
-- ============================================================
--
-- Generated from production database (PostgreSQL 15.8)
-- Schema: public (106 tables, RLS policies, functions, triggers)
--
-- IMPORTANT NOTES:
-- 1. This schema requires a Supabase project (Cloud or self-hosted).
--    Supabase provides the `auth`, `storage`, and `extensions` schemas.
--
-- 2. pgvector (for RAG/embeddings) requires Supabase Cloud or manual
--    installation. Without it, the AI semantic search won't work but
--    the rest of the platform operates normally.
--
-- 3. Apply this schema BEFORE running the application:
--    Option A — Supabase Cloud:
--      supabase db push  (uses migrations/ folder)
--    Option B — Self-hosted (Docker Compose):
--      Loaded automatically via docker-entrypoint-initdb.d/
--
-- 4. After applying schema, run seed.sql for base data:
--      psql -U postgres -d postgres -f supabase/seed.sql
--
-- ============================================================


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: add_credits(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_credits(p_user_id uuid, p_amount integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE v_balance INTEGER;
BEGIN
  UPDATE users SET credit_balance = credit_balance + p_amount
  WHERE id = p_user_id
  RETURNING credit_balance INTO v_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'balance', 0);
  END IF;

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;


--
-- Name: calculate_cron_duration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_cron_duration() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.finished_at IS NOT NULL AND OLD.finished_at IS NULL THEN
    NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.finished_at - NEW.started_at))::INTEGER * 1000;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: compute_daily_product_metrics(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_daily_product_metrics(target_date date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO product_daily_metrics (product_id, metric_date, orders, units_sold, revenue_cents, cogs_cents)
  SELECT
    oi.product_id,
    target_date,
    COUNT(DISTINCT oi.order_id),
    SUM(oi.quantity),
    SUM(oi.unit_price_cents * oi.quantity),
    SUM(COALESCE(oi.cost_cents, 0) * oi.quantity)
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE o.paid_at::date = target_date
    AND o.status NOT IN ('cancelled', 'refunded')
    AND oi.product_id IS NOT NULL
  GROUP BY oi.product_id
  ON CONFLICT (product_id, metric_date)
  DO UPDATE SET
    orders = EXCLUDED.orders,
    units_sold = EXCLUDED.units_sold,
    revenue_cents = EXCLUDED.revenue_cents,
    cogs_cents = EXCLUDED.cogs_cents;
END;
$$;


--
-- Name: compute_portfolio_metrics(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_portfolio_metrics(target_date date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_revenue INTEGER;
  v_orders INTEGER;
  v_aov INTEGER;
  v_margin DOUBLE PRECISION;
  v_refund_rate DOUBLE PRECISION;
  v_active INTEGER;
  v_zombie INTEGER;
  v_new INTEGER;
  v_delisted INTEGER;
BEGIN
  -- Revenue and orders
  SELECT COALESCE(SUM(total_cents), 0), COUNT(*)
  INTO v_revenue, v_orders
  FROM orders
  WHERE paid_at::date = target_date AND status NOT IN ('cancelled', 'refunded');

  v_aov := CASE WHEN v_orders > 0 THEN v_revenue / v_orders ELSE 0 END;

  -- Gross margin
  SELECT CASE
    WHEN SUM(revenue_cents) > 0 THEN (SUM(revenue_cents) - SUM(cogs_cents))::double precision / SUM(revenue_cents) * 100
    ELSE 0
  END INTO v_margin
  FROM product_daily_metrics WHERE metric_date = target_date;

  -- Refund rate (last 30 days)
  SELECT CASE
    WHEN COUNT(*) > 0 THEN COUNT(*) FILTER (WHERE status = 'refunded')::double precision / COUNT(*) * 100
    ELSE 0
  END INTO v_refund_rate
  FROM orders WHERE paid_at >= target_date - INTERVAL '30 days';

  -- Active products
  SELECT COUNT(*) INTO v_active FROM products WHERE status = 'active';

  -- Zombie products (active, 0 sales in 30 days)
  SELECT COUNT(*) INTO v_zombie
  FROM products p
  WHERE p.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = p.id AND o.paid_at >= target_date - INTERVAL '30 days'
    );

  -- New products listed today
  SELECT COUNT(*) INTO v_new FROM products WHERE created_at::date = target_date;

  -- Products delisted today
  SELECT COUNT(*) INTO v_delisted FROM products
  WHERE status IN ('archived', 'deleted') AND updated_at::date = target_date;

  INSERT INTO daily_portfolio_metrics (date, total_revenue_cents, total_orders, aov_cents, gross_margin_pct, refund_rate_pct, active_products, zombie_products, new_products_listed, products_delisted)
  VALUES (target_date, v_revenue, v_orders, v_aov, v_margin, v_refund_rate, v_active, v_zombie, v_new, v_delisted)
  ON CONFLICT (date) DO UPDATE SET
    total_revenue_cents = EXCLUDED.total_revenue_cents,
    total_orders = EXCLUDED.total_orders,
    aov_cents = EXCLUDED.aov_cents,
    gross_margin_pct = EXCLUDED.gross_margin_pct,
    refund_rate_pct = EXCLUDED.refund_rate_pct,
    active_products = EXCLUDED.active_products,
    zombie_products = EXCLUDED.zombie_products,
    new_products_listed = EXCLUDED.new_products_listed,
    products_delisted = EXCLUDED.products_delisted;
END;
$$;


--
-- Name: consume_credit_atomic(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_credit_atomic(p_user_id uuid, p_action character varying) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_balance INTEGER;
  v_tier    VARCHAR;
BEGIN
  -- Only premium users may spend credits
  SELECT tier INTO v_tier FROM users WHERE id = p_user_id;

  IF v_tier IS DISTINCT FROM 'premium' THEN
    RETURN jsonb_build_object('success', false, 'error', 'credits_require_premium', 'balance', 0);
  END IF;

  UPDATE users SET credit_balance = credit_balance - 1
  WHERE id = p_user_id AND credit_balance > 0
  RETURNING credit_balance INTO v_balance;

  IF NOT FOUND THEN
    SELECT credit_balance INTO v_balance FROM users WHERE id = p_user_id;
    RETURN jsonb_build_object('success', false, 'balance', COALESCE(v_balance, 0));
  END IF;

  INSERT INTO credit_transactions (user_id, amount, reason, balance_after)
  VALUES (p_user_id, -1, p_action, v_balance);

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;


--
-- Name: create_product_belief(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_product_belief() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO product_beliefs (product_id, listed_at)
  VALUES (NEW.id, COALESCE(NEW.published_at, NOW()))
  ON CONFLICT (product_id) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: decrement_usage(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_usage(p_identifier text, p_action text, p_period text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE user_usage
  SET count = GREATEST(count - 1, 0)
  WHERE identifier = p_identifier
    AND action = p_action
    AND period = p_period;
END;
$$;


--
-- Name: get_current_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(
    -- Try JWT app_metadata.tenant_id first
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
    -- Fallback to custom GUC (set by server before query)
    NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
$$;


--
-- Name: get_user_roles(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_roles(user_uuid uuid) RETURNS TABLE(role_id uuid, role_name character varying, display_name character varying, permissions jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id,
    ar.name,
    ar.display_name,
    ar.permissions
  FROM user_roles ur
  JOIN admin_roles ar ON ur.role_id = ar.id
  WHERE ur.user_id = user_uuid;
END;
$$;


--
-- Name: FUNCTION get_user_roles(user_uuid uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_roles(user_uuid uuid) IS 'Get all roles assigned to a user with their permissions';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.users (id, email, name, email_verified, avatar_url, locale, currency, created_at, updated_at)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email_confirmed_at IS NOT NULL,
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en'), 'EUR', NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email, name = COALESCE(EXCLUDED.name, users.name),
    email_verified = EXCLUDED.email_verified, avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END; $$;


--
-- Name: has_permission(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_permission(user_uuid uuid, resource text, action text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN admin_roles ar ON ur.role_id = ar.id
    WHERE ur.user_id = user_uuid
      AND ar.permissions->resource ? action
  ) INTO has_perm;

  RETURN has_perm;
END;
$$;


--
-- Name: FUNCTION has_permission(user_uuid uuid, resource text, action text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.has_permission(user_uuid uuid, resource text, action text) IS 'Check if a user has a specific permission for a resource';


--
-- Name: increment_coupon_usage(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_coupon_usage(p_coupon_id uuid, p_order_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Try to insert into coupon_uses (fails on duplicate = idempotent)
  INSERT INTO coupon_uses (coupon_id, order_id)
  VALUES (p_coupon_id, p_order_id);

  -- Atomic increment
  UPDATE coupons SET times_used = times_used + 1 WHERE id = p_coupon_id;

  RETURN TRUE;
EXCEPTION WHEN unique_violation THEN
  -- Already counted for this order — idempotent skip
  RETURN FALSE;
END;
$$;


--
-- Name: increment_coupon_usage(uuid, uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_coupon_usage(p_coupon_id uuid, p_order_id uuid, p_user_id uuid DEFAULT NULL::uuid, p_discount_cents integer DEFAULT 0) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO coupon_uses (coupon_id, order_id, user_id, discount_cents)
  VALUES (p_coupon_id, p_order_id, p_user_id, p_discount_cents);

  UPDATE coupons SET times_used = times_used + 1 WHERE id = p_coupon_id;
  RETURN TRUE;
EXCEPTION WHEN unique_violation THEN
  RETURN FALSE;
END;
$$;


--
-- Name: increment_usage(character varying, character varying, character varying, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_usage(p_identifier character varying, p_action character varying, p_period character varying, p_limit integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_current INTEGER;
BEGIN
  INSERT INTO user_usage (identifier, action, period, count)
  VALUES (p_identifier, p_action, p_period, 1)
  ON CONFLICT (identifier, action, period) DO UPDATE
    SET count = user_usage.count + 1, updated_at = now()
  RETURNING count INTO v_current;

  IF v_current > p_limit AND p_limit >= 0 THEN
    -- Rollback the increment
    UPDATE user_usage SET count = count - 1
    WHERE identifier = p_identifier AND action = p_action AND period = p_period;
    RETURN jsonb_build_object('allowed', false, 'current', v_current - 1, 'limit', p_limit);
  END IF;

  RETURN jsonb_build_object('allowed', true, 'current', v_current, 'limit', p_limit);
END;
$$;


--
-- Name: increment_usage_by(character varying, character varying, character varying, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_usage_by(p_identifier character varying, p_action character varying, p_period character varying, p_amount integer, p_limit integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE v_current INTEGER;
BEGIN
  INSERT INTO user_usage (identifier, action, period, count)
  VALUES (p_identifier, p_action, p_period, p_amount)
  ON CONFLICT (identifier, action, period) DO UPDATE
    SET count = user_usage.count + p_amount, updated_at = now()
  RETURNING count INTO v_current;

  RETURN jsonb_build_object('current', v_current, 'limit', p_limit, 'over', v_current > p_limit);
END;
$$;


--
-- Name: issue_refund_atomic(uuid, integer, text, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.issue_refund_atomic(p_order_id uuid, p_refund_amount_cents integer, p_refund_reason text, p_stripe_refund_id character varying DEFAULT NULL::character varying) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_already_refunded boolean;
BEGIN
  SELECT (refunded_at IS NOT NULL) INTO v_already_refunded
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_already_refunded THEN
    RETURN FALSE;
  END IF;

  UPDATE orders
  SET
    refunded_at = now(),
    refund_amount_cents = p_refund_amount_cents,
    refund_reason = p_refund_reason,
    stripe_refund_id = p_stripe_refund_id
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$$;


--
-- Name: migrate_usage(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.migrate_usage(p_old_identifier text, p_new_identifier text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_migrated INTEGER := 0;
BEGIN
  -- Merge counts: add old anonymous counts to new user identifier
  INSERT INTO user_usage (identifier, action, period, count)
  SELECT p_new_identifier, action, period, count
  FROM user_usage WHERE identifier = p_old_identifier
  ON CONFLICT (identifier, action, period)
  DO UPDATE SET count = user_usage.count + EXCLUDED.count;

  GET DIAGNOSTICS v_migrated = ROW_COUNT;

  -- Delete old anonymous records
  DELETE FROM user_usage WHERE identifier = p_old_identifier;

  RETURN v_migrated;
END;
$$;


--
-- Name: test_partition_pruning(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.test_partition_pruning() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  explain_output TEXT;
BEGIN
  -- Test EXPLAIN on agent_events with time range (should only scan Feb 2026 partition)
  EXPLAIN (FORMAT TEXT)
    SELECT * FROM agent_events
    WHERE created_at >= '2026-02-01' AND created_at < '2026-02-28'
  INTO explain_output;

  RETURN explain_output;
END;
$$;


--
-- Name: test_try_cron_lock_behavior(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.test_try_cron_lock_behavior() RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_first_attempt boolean;
  v_second_attempt boolean;
  v_third_attempt_diff_name boolean;
BEGIN
  -- First attempt: should succeed (return TRUE)
  v_first_attempt := try_cron_lock('test_lock_demo');

  -- Second attempt with same name: should fail (return FALSE) because lock already held
  v_second_attempt := try_cron_lock('test_lock_demo');

  -- Third attempt with different name: should succeed (return TRUE)
  v_third_attempt_diff_name := try_cron_lock('different_lock');

  -- Return results as JSON
  RETURN jsonb_build_object(
    'first_attempt', v_first_attempt,
    'second_attempt_same_lock', v_second_attempt,
    'third_attempt_different_lock', v_third_attempt_diff_name,
    'test_passed', (v_first_attempt = true AND v_second_attempt = false AND v_third_attempt_diff_name = true)
  );
END;
$$;


--
-- Name: FUNCTION test_try_cron_lock_behavior(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.test_try_cron_lock_behavior() IS 'Test function to verify try_cron_lock() prevents duplicate acquisitions within same session';


--
-- Name: trigger_update_product_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_update_product_rating() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_product_rating(OLD.product_id);
  ELSE
    PERFORM update_product_rating(NEW.product_id);
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: try_cron_lock(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.try_cron_lock(p_cron_name text) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_lock_key bigint;
BEGIN
  -- Convert cron job name to a numeric lock key
  -- hashtext() returns a stable hash for the same input
  v_lock_key := hashtext(p_cron_name);

  -- Try to acquire transaction-level advisory lock (non-blocking, non-re-entrant)
  -- Returns TRUE if lock acquired, FALSE if already held (even by same session)
  -- Lock is automatically released at end of transaction
  RETURN pg_try_advisory_xact_lock(v_lock_key);
END;
$$;


--
-- Name: FUNCTION try_cron_lock(p_cron_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.try_cron_lock(p_cron_name text) IS 'Acquires a transaction-level advisory lock for a cron job. Returns TRUE if acquired, FALSE if already held (even by same session within transaction). Lock is automatically released at transaction end. Prevents concurrent execution of the same cron job.';


--
-- Name: update_abandoned_carts_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_abandoned_carts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_blog_posts_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_blog_posts_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_cart_items_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_cart_items_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_error_logs_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_error_logs_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_legal_pages_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_legal_pages_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_legal_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_legal_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_product_belief(uuid, integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_product_belief(p_id uuid, new_views integer, new_sales integer, new_revenue integer DEFAULT 0, new_cogs integer DEFAULT 0) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO product_beliefs (product_id, alpha, beta, views_total, sales_total, revenue_total_cents, cogs_total_cents)
  VALUES (p_id, 1.0 + new_sales, 1.0 + (new_views - new_sales), new_views, new_sales, new_revenue, new_cogs)
  ON CONFLICT (product_id) DO UPDATE SET
    alpha = product_beliefs.alpha + new_sales,
    beta = product_beliefs.beta + (new_views - new_sales),
    views_total = product_beliefs.views_total + new_views,
    sales_total = product_beliefs.sales_total + new_sales,
    revenue_total_cents = product_beliefs.revenue_total_cents + new_revenue,
    cogs_total_cents = product_beliefs.cogs_total_cents + new_cogs,
    last_sale_at = CASE WHEN new_sales > 0 THEN NOW() ELSE product_beliefs.last_sale_at END,
    updated_at = NOW();
END;
$$;


--
-- Name: update_product_rating(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_product_rating(p_product_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_avg_rating NUMERIC;
  v_count INTEGER;
BEGIN
  SELECT AVG(rating), COUNT(*)
  INTO v_avg_rating, v_count
  FROM product_reviews
  WHERE product_id = p_product_id;

  UPDATE products
  SET
    avg_rating = COALESCE(ROUND(v_avg_rating, 1), 0),
    review_count = v_count,
    updated_at = NOW()
  WHERE id = p_product_id;
END;
$$;


--
-- Name: update_return_requests_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_return_requests_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_returns_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_returns_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_store_themes_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_store_themes_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_tenant_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_tenant_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: verify_partitioning(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_partitioning() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  result JSON;
BEGIN
  WITH table_info AS (
    SELECT
      c.relname AS table_name,
      c.relkind AS table_kind,
      CASE
        WHEN c.relkind = 'p' THEN 'partitioned'
        WHEN c.relkind = 'r' THEN 'regular'
        ELSE 'other'
      END AS table_type
    FROM pg_class c
    WHERE c.relname IN ('agent_events', 'messages', 'audit_log')
      AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ),
  partition_info AS (
    SELECT
      pt.tablename AS partition_name,
      CASE
        WHEN pt.tablename LIKE 'agent_events_%' THEN 'agent_events'
        WHEN pt.tablename LIKE 'messages_%' THEN 'messages'
        WHEN pt.tablename LIKE 'audit_log_%' THEN 'audit_log'
      END AS parent_table
    FROM pg_tables pt
    WHERE pt.schemaname = 'public'
      AND pt.tablename LIKE '%_y2026m%'
  )
  SELECT json_build_object(
    'tables', (SELECT json_agg(table_info) FROM table_info),
    'partitions', (SELECT json_agg(partition_info) FROM partition_info),
    'partition_counts', json_build_object(
      'agent_events', (SELECT count(*) FROM partition_info WHERE parent_table = 'agent_events'),
      'messages', (SELECT count(*) FROM partition_info WHERE parent_table = 'messages'),
      'audit_log', (SELECT count(*) FROM partition_info WHERE parent_table = 'audit_log')
    ),
    'verified_at', NOW()
  ) INTO result;

  RETURN result;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ab_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ab_events (
    id bigint NOT NULL,
    experiment_id uuid NOT NULL,
    variant text NOT NULL,
    event_type text NOT NULL,
    value numeric,
    user_id uuid,
    session_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ab_events_event_type_check CHECK ((event_type = ANY (ARRAY['impression'::text, 'click'::text, 'conversion'::text, 'revenue'::text])))
);


--
-- Name: ab_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ab_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ab_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ab_events_id_seq OWNED BY public.ab_events.id;


--
-- Name: ab_experiments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ab_experiments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    variants jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ab_experiments_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'running'::text, 'completed'::text])))
);


--
-- Name: abandoned_carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.abandoned_carts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id character varying(255),
    user_id uuid,
    email character varying(255) NOT NULL,
    locale character varying(10) DEFAULT 'en'::character varying NOT NULL,
    first_email_sent_at timestamp with time zone,
    second_email_sent_at timestamp with time zone,
    cart_last_updated_at timestamp with time zone NOT NULL,
    recovered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT abandoned_carts_identifier_check CHECK ((((session_id IS NOT NULL) AND (user_id IS NULL)) OR ((session_id IS NULL) AND (user_id IS NOT NULL))))
);


--
-- Name: admin_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    display_name character varying(100) NOT NULL,
    description text,
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE admin_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.admin_roles IS 'Defines admin roles with granular permissions for RBAC';


--
-- Name: COLUMN admin_roles.permissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.admin_roles.permissions IS 'JSONB object with resource->actions mapping (e.g., {"products": ["read", "update"]})';


--
-- Name: COLUMN admin_roles.is_system; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.admin_roles.is_system IS 'System roles cannot be deleted or renamed (but permissions can be updated)';


--
-- Name: admin_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_settings (
    id integer DEFAULT 1 NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_settings_id_check CHECK ((id = 1))
);


--
-- Name: agent_daily_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_daily_costs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agent_name character varying(50) NOT NULL,
    date date NOT NULL,
    total_cost numeric(10,4) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: agent_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_events (
    id bigint NOT NULL,
    session_id uuid,
    event_type character varying(50) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_name character varying(50)
)
PARTITION BY RANGE (created_at);


--
-- Name: agent_events_new_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agent_events_new_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_events_new_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agent_events_new_id_seq OWNED BY public.agent_events.id;


--
-- Name: agent_events_y2026m02; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_events_y2026m02 (
    id bigint DEFAULT nextval('public.agent_events_new_id_seq'::regclass) NOT NULL,
    session_id uuid,
    event_type character varying(50) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_name character varying(50)
);


--
-- Name: agent_events_y2026m03; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_events_y2026m03 (
    id bigint DEFAULT nextval('public.agent_events_new_id_seq'::regclass) NOT NULL,
    session_id uuid,
    event_type character varying(50) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_name character varying(50)
);


--
-- Name: agent_events_y2026m04; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_events_y2026m04 (
    id bigint DEFAULT nextval('public.agent_events_new_id_seq'::regclass) NOT NULL,
    session_id uuid,
    event_type character varying(50) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_name character varying(50)
);


--
-- Name: agent_events_y2026m05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_events_y2026m05 (
    id bigint DEFAULT nextval('public.agent_events_new_id_seq'::regclass) NOT NULL,
    session_id uuid,
    event_type character varying(50) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_name character varying(50)
);


--
-- Name: agent_events_y2026m06; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_events_y2026m06 (
    id bigint DEFAULT nextval('public.agent_events_new_id_seq'::regclass) NOT NULL,
    session_id uuid,
    event_type character varying(50) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_name character varying(50)
);


--
-- Name: agent_events_y2026m07; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_events_y2026m07 (
    id bigint DEFAULT nextval('public.agent_events_new_id_seq'::regclass) NOT NULL,
    session_id uuid,
    event_type character varying(50) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_name character varying(50)
);


--
-- Name: agent_events_y2026m08; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_events_y2026m08 (
    id bigint DEFAULT nextval('public.agent_events_new_id_seq'::regclass) NOT NULL,
    session_id uuid,
    event_type character varying(50) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    agent_name character varying(50)
);


--
-- Name: agent_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_number integer,
    session_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'running'::character varying NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    features_before integer,
    features_after integer,
    tool_calls integer DEFAULT 0 NOT NULL,
    tool_errors integer DEFAULT 0 NOT NULL,
    memory_snapshot text,
    error_log text,
    CONSTRAINT agent_sessions_session_type_check CHECK (((session_type)::text = ANY ((ARRAY['researcher'::character varying, 'designer'::character varying, 'cataloger'::character varying, 'qa_inspector'::character varying, 'marketing'::character varying, 'customer_support'::character varying, 'finance'::character varying, 'heartbeat'::character varying, 'consolidation'::character varying, 'orchestrator'::character varying, 'customer_manager'::character varying, 'newsletter'::character varying, 'seo_manager'::character varying, 'brand_manager'::character varying])::text[]))),
    CONSTRAINT agent_sessions_status_check CHECK (((status)::text = ANY (ARRAY[('running'::character varying)::text, ('completed'::character varying)::text, ('error'::character varying)::text])))
);


--
-- Name: ai_generations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_generations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    user_id uuid NOT NULL,
    prompt text NOT NULL,
    engineered_prompt text,
    negative_prompt text,
    intent text,
    provider text NOT NULL,
    image_url text,
    cost_usd numeric(10,4) DEFAULT 0,
    inference_ms integer,
    is_refinement boolean DEFAULT false,
    parent_generation_id uuid,
    moderation_status text DEFAULT 'approved'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    confidence numeric(3,2) DEFAULT NULL::numeric,
    style_preset text,
    product_type text,
    product_id text,
    seed text,
    CONSTRAINT ai_generations_intent_check CHECK ((intent = ANY (ARRAY['artistic'::text, 'text-heavy'::text, 'photorealistic'::text, 'vector'::text, 'pattern'::text, 'quick-draft'::text, 'general'::text]))),
    CONSTRAINT ai_generations_moderation_status_check CHECK ((moderation_status = ANY (ARRAY['approved'::text, 'flagged'::text, 'rejected'::text])))
);


--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_name text NOT NULL,
    user_id uuid,
    session_id text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb,
    page_url text,
    referrer text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid DEFAULT 'f1c548a3-b69d-4328-a372-c4924a660044'::uuid NOT NULL
);


--
-- Name: association_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.association_rules (
    id bigint NOT NULL,
    antecedents text[] NOT NULL,
    consequents text[] NOT NULL,
    support numeric NOT NULL,
    confidence numeric NOT NULL,
    lift numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: association_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.association_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: association_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.association_rules_id_seq OWNED BY public.association_rules.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_type character varying(20) NOT NULL,
    actor_id character varying(100) NOT NULL,
    action character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    changes jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_new_actor_type_check CHECK (((actor_type)::text = ANY (ARRAY[('admin'::character varying)::text, ('ai_agent'::character varying)::text, ('system'::character varying)::text, ('webhook'::character varying)::text])))
)
PARTITION BY RANGE (created_at);


--
-- Name: audit_log_y2026m02; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m02 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_type character varying(20) NOT NULL,
    actor_id character varying(100) NOT NULL,
    action character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    changes jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_new_actor_type_check CHECK (((actor_type)::text = ANY (ARRAY[('admin'::character varying)::text, ('ai_agent'::character varying)::text, ('system'::character varying)::text, ('webhook'::character varying)::text])))
);


--
-- Name: audit_log_y2026m03; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m03 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_type character varying(20) NOT NULL,
    actor_id character varying(100) NOT NULL,
    action character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    changes jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_new_actor_type_check CHECK (((actor_type)::text = ANY (ARRAY[('admin'::character varying)::text, ('ai_agent'::character varying)::text, ('system'::character varying)::text, ('webhook'::character varying)::text])))
);


--
-- Name: audit_log_y2026m04; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m04 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_type character varying(20) NOT NULL,
    actor_id character varying(100) NOT NULL,
    action character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    changes jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_new_actor_type_check CHECK (((actor_type)::text = ANY (ARRAY[('admin'::character varying)::text, ('ai_agent'::character varying)::text, ('system'::character varying)::text, ('webhook'::character varying)::text])))
);


--
-- Name: audit_log_y2026m05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m05 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_type character varying(20) NOT NULL,
    actor_id character varying(100) NOT NULL,
    action character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    changes jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_new_actor_type_check CHECK (((actor_type)::text = ANY (ARRAY[('admin'::character varying)::text, ('ai_agent'::character varying)::text, ('system'::character varying)::text, ('webhook'::character varying)::text])))
);


--
-- Name: audit_log_y2026m06; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m06 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_type character varying(20) NOT NULL,
    actor_id character varying(100) NOT NULL,
    action character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    changes jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_new_actor_type_check CHECK (((actor_type)::text = ANY (ARRAY[('admin'::character varying)::text, ('ai_agent'::character varying)::text, ('system'::character varying)::text, ('webhook'::character varying)::text])))
);


--
-- Name: audit_log_y2026m07; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m07 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_type character varying(20) NOT NULL,
    actor_id character varying(100) NOT NULL,
    action character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    changes jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_new_actor_type_check CHECK (((actor_type)::text = ANY (ARRAY[('admin'::character varying)::text, ('ai_agent'::character varying)::text, ('system'::character varying)::text, ('webhook'::character varying)::text])))
);


--
-- Name: audit_log_y2026m08; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m08 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_type character varying(20) NOT NULL,
    actor_id character varying(100) NOT NULL,
    action character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id uuid,
    changes jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_new_actor_type_check CHECK (((actor_type)::text = ANY (ARRAY[('admin'::character varying)::text, ('ai_agent'::character varying)::text, ('system'::character varying)::text, ('webhook'::character varying)::text])))
);


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(255) NOT NULL,
    title_en text NOT NULL,
    title_es text NOT NULL,
    title_de text NOT NULL,
    content_en text NOT NULL,
    content_es text NOT NULL,
    content_de text NOT NULL,
    excerpt_en text,
    excerpt_es text,
    excerpt_de text,
    featured_image character varying(500),
    author_id uuid,
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    tags text[] DEFAULT ARRAY[]::text[],
    CONSTRAINT blog_posts_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('published'::character varying)::text, ('archived'::character varying)::text])))
);


--
-- Name: brand_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brand_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    neck_label_image_id text,
    neck_label_preview_url text,
    packaging_insert_enabled boolean DEFAULT false,
    packaging_insert_text text,
    gift_messages_enabled boolean DEFAULT false,
    brand_color_primary text DEFAULT '#000000'::text,
    brand_color_secondary text DEFAULT '#FFFFFF'::text,
    brand_font text DEFAULT 'Inter'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    personalization_surcharge_amount numeric(10,2) DEFAULT NULL::numeric,
    brand_name text DEFAULT 'My Store'::text,
    brand_tagline text DEFAULT 'AI-Powered Print on Demand'::text,
    seo_titles jsonb DEFAULT '{"de": "Your Store - KI-gesteuerte Print-on-Demand-Plattform", "en": "Your Store - AI Print on Demand", "es": "Your Store - Impresión bajo Demanda con IA"}'::jsonb,
    seo_descriptions jsonb DEFAULT '{"de": "Erstellen Sie einzigartige personalisierte Produkte mit KI-gestützten Designwerkzeugen und Druck auf Abruf", "en": "Create unique custom products with AI-powered design tools and on-demand printing", "es": "Crea productos personalizados únicos con herramientas de diseño impulsadas por IA e impresión bajo demanda"}'::jsonb,
    logo_light_url text,
    logo_dark_url text,
    support_email text DEFAULT 'support@yourdomain.com'::text,
    social_links jsonb DEFAULT '{"twitter": "", "facebook": "", "linkedin": "", "instagram": ""}'::jsonb,
    copyright_text text DEFAULT '© 2026 Your Store. All rights reserved.'::text
);


--
-- Name: COLUMN brand_config.personalization_surcharge_amount; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brand_config.personalization_surcharge_amount IS 'Optional flat fee (in store base currency) added to products with custom text personalization. NULL = no surcharge.';


--
-- Name: COLUMN brand_config.brand_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brand_config.brand_name IS 'Brand name displayed across the platform (e.g., "My Store")';


--
-- Name: COLUMN brand_config.brand_tagline; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brand_config.brand_tagline IS 'Brand tagline or slogan';


--
-- Name: COLUMN brand_config.seo_titles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brand_config.seo_titles IS 'Localized SEO page titles (JSONB with en/es/de keys)';


--
-- Name: COLUMN brand_config.seo_descriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brand_config.seo_descriptions IS 'Localized SEO meta descriptions (JSONB with en/es/de keys)';


--
-- Name: COLUMN brand_config.logo_light_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brand_config.logo_light_url IS 'URL for logo used in light mode';


--
-- Name: COLUMN brand_config.logo_dark_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brand_config.logo_dark_url IS 'URL for logo used in dark mode';


--
-- Name: COLUMN brand_config.support_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brand_config.support_email IS 'Customer support contact email';


--
-- Name: COLUMN brand_config.social_links; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brand_config.social_links IS 'Social media profile links (JSONB object)';


--
-- Name: COLUMN brand_config.copyright_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brand_config.copyright_text IS 'Copyright notice displayed in footer';


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id character varying(255),
    user_id uuid,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    personalization_id uuid,
    tenant_id uuid DEFAULT 'f1c548a3-b69d-4328-a372-c4924a660044'::uuid NOT NULL,
    composition_id uuid,
    CONSTRAINT cart_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    parent_id uuid,
    name_en text NOT NULL,
    name_es text NOT NULL,
    name_de text NOT NULL,
    icon text,
    image_url text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid DEFAULT 'f1c548a3-b69d-4328-a372-c4924a660044'::uuid NOT NULL
);


--
-- Name: collection_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_products (
    collection_id uuid NOT NULL,
    product_id uuid NOT NULL,
    "position" integer DEFAULT 0,
    is_featured boolean DEFAULT false
);


--
-- Name: collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name jsonb DEFAULT '{}'::jsonb NOT NULL,
    description jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'draft'::text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT collections_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])))
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    session_id character varying(255),
    title character varying(500),
    model character varying(100),
    locale character(5) DEFAULT 'en'::bpchar NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    tenant_id uuid DEFAULT 'f1c548a3-b69d-4328-a372-c4924a660044'::uuid NOT NULL
);


--
-- Name: coupon_uses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_uses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coupon_id uuid NOT NULL,
    order_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    discount_cents integer DEFAULT 0 NOT NULL
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    discount_type character varying(20) NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    min_purchase_amount numeric(10,2),
    max_discount_amount numeric(10,2),
    usage_limit integer,
    times_used integer DEFAULT 0,
    valid_from timestamp with time zone DEFAULT now(),
    valid_until timestamp with time zone,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    per_user_limit integer DEFAULT 1,
    first_purchase_only boolean DEFAULT false,
    user_id uuid,
    code_type character varying(20) DEFAULT 'public'::character varying,
    campaign_name character varying(100),
    CONSTRAINT coupons_code_type_check CHECK (((code_type)::text = ANY (ARRAY[('public'::character varying)::text, ('personal'::character varying)::text, ('bulk'::character varying)::text]))),
    CONSTRAINT coupons_discount_type_check CHECK (((discount_type)::text = ANY (ARRAY[('percentage'::character varying)::text, ('fixed_amount'::character varying)::text]))),
    CONSTRAINT coupons_discount_value_check CHECK ((discount_value > (0)::numeric))
);


--
-- Name: credit_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    reason character varying(100) NOT NULL,
    stripe_payment_id character varying(255),
    balance_after integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cron_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cron_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cron_name character varying(255) NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    status character varying(20) DEFAULT 'running'::character varying NOT NULL,
    duration_ms integer,
    error_message text,
    rows_affected integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cron_runs_status_check CHECK (((status)::text = ANY (ARRAY[('running'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text, ('skipped'::character varying)::text])))
);


--
-- Name: TABLE cron_runs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cron_runs IS 'Tracks execution of scheduled cron jobs with status, timing, and error information';


--
-- Name: COLUMN cron_runs.cron_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cron_runs.cron_name IS 'Unique identifier for the cron job';


--
-- Name: COLUMN cron_runs.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cron_runs.status IS 'Current status: running, completed, failed, or skipped';


--
-- Name: COLUMN cron_runs.duration_ms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cron_runs.duration_ms IS 'Execution duration in milliseconds (finished_at - started_at)';


--
-- Name: COLUMN cron_runs.rows_affected; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cron_runs.rows_affected IS 'Number of rows affected by the cron job (if applicable)';


--
-- Name: customer_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_segments (
    customer_id uuid NOT NULL,
    recency integer NOT NULL,
    frequency integer NOT NULL,
    monetary numeric NOT NULL,
    rfm_score text NOT NULL,
    segment text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: daily_portfolio_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_portfolio_metrics (
    date date NOT NULL,
    total_revenue_cents integer DEFAULT 0 NOT NULL,
    total_orders integer DEFAULT 0 NOT NULL,
    aov_cents integer DEFAULT 0 NOT NULL,
    gross_margin_pct double precision,
    refund_rate_pct double precision,
    active_products integer DEFAULT 0 NOT NULL,
    zombie_products integer DEFAULT 0 NOT NULL,
    new_products_listed integer DEFAULT 0 NOT NULL,
    products_delisted integer DEFAULT 0 NOT NULL,
    exploration_rate double precision,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: demand_forecasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.demand_forecasts (
    id bigint NOT NULL,
    product_id uuid NOT NULL,
    forecast_date date NOT NULL,
    predicted_quantity numeric NOT NULL,
    lower_bound numeric,
    upper_bound numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: demand_forecasts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.demand_forecasts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: demand_forecasts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.demand_forecasts_id_seq OWNED BY public.demand_forecasts.id;


--
-- Name: design_clipart; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_clipart (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    name_es text,
    name_de text,
    category text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    svg_url text NOT NULL,
    thumbnail_url text,
    is_active boolean DEFAULT true,
    use_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: design_compositions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_compositions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_id uuid,
    product_id uuid,
    product_type text,
    schema_version integer DEFAULT 1 NOT NULL,
    layers jsonb DEFAULT '[]'::jsonb NOT NULL,
    preview_url text,
    production_url text,
    surcharge_amount numeric(10,2),
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT design_compositions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'applied'::text, 'ordered'::text])))
);


--
-- Name: design_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid,
    product_type text,
    status text DEFAULT 'active'::text NOT NULL,
    style_preset text,
    total_generations integer DEFAULT 0,
    total_cost_usd numeric(10,4) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    CONSTRAINT design_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'abandoned'::text])))
);


--
-- Name: design_templates_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.design_templates_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    name_es text,
    name_de text,
    category text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    thumbnail_url text NOT NULL,
    fabric_json jsonb NOT NULL,
    product_types text[] DEFAULT '{}'::text[],
    is_active boolean DEFAULT true,
    use_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: designs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.designs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    user_id uuid,
    prompt text NOT NULL,
    style character varying(100),
    model character varying(100),
    image_url text,
    thumbnail_url text,
    width integer,
    height integer,
    moderation_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    moderation_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    generation_time_ms integer,
    printify_upload_id character varying(255),
    printify_image_url text,
    moderated_by uuid,
    moderated_at timestamp with time zone,
    quality_score integer,
    quality_issues jsonb DEFAULT '[]'::jsonb,
    source_type character varying(20) DEFAULT 'fal'::character varying,
    source_url text,
    bg_removed_url text,
    bg_removed_at timestamp with time zone,
    privacy_level character varying(20) DEFAULT 'public'::character varying,
    expires_at timestamp with time zone,
    parent_design_id uuid,
    needs_upscale boolean DEFAULT false,
    tenant_id uuid DEFAULT 'f1c548a3-b69d-4328-a372-c4924a660044'::uuid NOT NULL,
    provider_upload_id text,
    pod_upload_url text,
    tags text[] DEFAULT '{}'::text[],
    CONSTRAINT designs_moderation_status_check CHECK (((moderation_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text]))),
    CONSTRAINT designs_privacy_level_check CHECK (((privacy_level)::text = ANY (ARRAY[('public'::character varying)::text, ('private'::character varying)::text, ('personal'::character varying)::text]))),
    CONSTRAINT designs_quality_score_check CHECK (((quality_score >= 1) AND (quality_score <= 10))),
    CONSTRAINT designs_source_type_check CHECK (((source_type)::text = ANY (ARRAY[('fal'::character varying)::text, ('gemini'::character varying)::text, ('sourced'::character varying)::text])))
);


--
-- Name: download_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.download_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    product_id uuid,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    download_count integer DEFAULT 0,
    max_downloads integer DEFAULT 5,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: drip_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drip_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    email character varying(255) NOT NULL,
    sequence character varying(50) NOT NULL,
    step integer NOT NULL,
    template character varying(50) NOT NULL,
    subject character varying(255) NOT NULL,
    send_at timestamp with time zone NOT NULL,
    sent_at timestamp with time zone,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: error_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.error_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message text NOT NULL,
    stack text,
    url text,
    user_agent text,
    error_hash text NOT NULL,
    count integer DEFAULT 1,
    first_seen timestamp with time zone DEFAULT now() NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE error_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.error_logs IS 'Stores client-side and server-side errors with deduplication';


--
-- Name: COLUMN error_logs.error_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.error_logs.error_hash IS 'SHA256 hash of message+stack for deduplication';


--
-- Name: COLUMN error_logs.count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.error_logs.count IS 'Number of times this error has occurred';


--
-- Name: COLUMN error_logs.first_seen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.error_logs.first_seen IS 'Timestamp when error was first seen';


--
-- Name: COLUMN error_logs.last_seen; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.error_logs.last_seen IS 'Timestamp when error was last seen';


--
-- Name: heartbeat_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.heartbeat_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type character varying(50) NOT NULL,
    priority integer DEFAULT 1 NOT NULL,
    source character varying(50),
    agent_name character varying(50),
    message text,
    fingerprint character varying(64),
    payload jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: hero_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hero_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    priority integer DEFAULT 0,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    title jsonb DEFAULT '{}'::jsonb NOT NULL,
    subtitle jsonb DEFAULT '{}'::jsonb,
    cta_text jsonb DEFAULT '{}'::jsonb NOT NULL,
    cta_url text DEFAULT '/shop'::text NOT NULL,
    sub_cta_text jsonb DEFAULT '{}'::jsonb,
    image_url text,
    image_alt jsonb DEFAULT '{}'::jsonb,
    og_image_url text,
    collection_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    shop_hero_image_url text,
    CONSTRAINT hero_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'active'::text, 'archived'::text])))
);


--
-- Name: legal_page_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legal_page_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    legal_page_id uuid NOT NULL,
    version_number integer NOT NULL,
    title_en text NOT NULL,
    title_es text NOT NULL,
    title_de text NOT NULL,
    content_en text NOT NULL,
    content_es text NOT NULL,
    content_de text NOT NULL,
    changed_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE legal_page_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.legal_page_versions IS 'Audit trail for legal page changes';


--
-- Name: legal_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legal_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title_en text NOT NULL,
    title_es text NOT NULL,
    title_de text NOT NULL,
    content_en text NOT NULL,
    content_es text NOT NULL,
    content_de text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE legal_pages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.legal_pages IS 'Legal page content in multiple locales with markdown and placeholder variables';


--
-- Name: COLUMN legal_pages.content_en; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.legal_pages.content_en IS 'Markdown content with {{placeholder}} variables';


--
-- Name: legal_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legal_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE legal_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.legal_settings IS 'Stores company legal information (GDPR compliance, contact details, legal page references)';


--
-- Name: COLUMN legal_settings.settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.legal_settings.settings IS 'JSONB object containing: company_name, company_address, tax_id, company_email, dpo_name, dpo_email, trade_register_court, trade_register_number, privacy_policy_url, terms_of_service_url, cookie_policy_url';


--
-- Name: marketing_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_content (
    id bigint NOT NULL,
    agent_session_id text,
    platform text NOT NULL,
    campaign_name text,
    product_id uuid,
    copy text NOT NULL,
    hashtags text[],
    cta text,
    alt_text text,
    scheduled_at timestamp with time zone,
    published_at timestamp with time zone,
    status text DEFAULT 'draft'::text,
    performance jsonb DEFAULT '{}'::jsonb,
    locale text DEFAULT 'en'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: marketing_content_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.marketing_content ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.marketing_content_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: message_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating smallint NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT message_feedback_rating_check CHECK ((rating = ANY (ARRAY['-1'::integer, 1])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    tool_calls jsonb,
    tool_results jsonb,
    tokens_used integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parts jsonb,
    CONSTRAINT messages_new_role_check CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('assistant'::character varying)::text, ('system'::character varying)::text])))
)
PARTITION BY RANGE (created_at);


--
-- Name: messages_y2026m02; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages_y2026m02 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    tool_calls jsonb,
    tool_results jsonb,
    tokens_used integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parts jsonb,
    CONSTRAINT messages_new_role_check CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('assistant'::character varying)::text, ('system'::character varying)::text])))
);


--
-- Name: messages_y2026m03; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages_y2026m03 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    tool_calls jsonb,
    tool_results jsonb,
    tokens_used integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parts jsonb,
    CONSTRAINT messages_new_role_check CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('assistant'::character varying)::text, ('system'::character varying)::text])))
);


--
-- Name: messages_y2026m04; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages_y2026m04 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    tool_calls jsonb,
    tool_results jsonb,
    tokens_used integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parts jsonb,
    CONSTRAINT messages_new_role_check CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('assistant'::character varying)::text, ('system'::character varying)::text])))
);


--
-- Name: messages_y2026m05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages_y2026m05 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    tool_calls jsonb,
    tool_results jsonb,
    tokens_used integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parts jsonb,
    CONSTRAINT messages_new_role_check CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('assistant'::character varying)::text, ('system'::character varying)::text])))
);


--
-- Name: messages_y2026m06; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages_y2026m06 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    tool_calls jsonb,
    tool_results jsonb,
    tokens_used integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parts jsonb,
    CONSTRAINT messages_new_role_check CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('assistant'::character varying)::text, ('system'::character varying)::text])))
);


--
-- Name: messages_y2026m07; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages_y2026m07 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    tool_calls jsonb,
    tool_results jsonb,
    tokens_used integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parts jsonb,
    CONSTRAINT messages_new_role_check CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('assistant'::character varying)::text, ('system'::character varying)::text])))
);


--
-- Name: messages_y2026m08; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages_y2026m08 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    tool_calls jsonb,
    tool_results jsonb,
    tokens_used integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parts jsonb,
    CONSTRAINT messages_new_role_check CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('assistant'::character varying)::text, ('system'::character varying)::text])))
);


--
-- Name: messaging_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messaging_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform character varying(20) NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messaging_channels_platform_check CHECK (((platform)::text = ANY (ARRAY[('telegram'::character varying)::text, ('whatsapp'::character varying)::text])))
);


--
-- Name: messaging_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messaging_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_messaging_link_id uuid,
    platform character varying(20) NOT NULL,
    direction character varying(10) NOT NULL,
    message_type character varying(20) DEFAULT 'text'::character varying NOT NULL,
    content text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messaging_conversations_direction_check CHECK (((direction)::text = ANY (ARRAY[('inbound'::character varying)::text, ('outbound'::character varying)::text])))
);


--
-- Name: newsletter_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_campaigns (
    id bigint NOT NULL,
    agent_session_id text,
    campaign_name text NOT NULL,
    segment text NOT NULL,
    locale text DEFAULT 'en'::text,
    subject_a text,
    subject_b text,
    preview_text text,
    body_html text,
    cta_a text,
    cta_b text,
    status text DEFAULT 'draft'::text,
    sent_count integer DEFAULT 0,
    delivered_count integer DEFAULT 0,
    open_rate numeric(5,2),
    click_rate numeric(5,2),
    unsubscribe_count integer DEFAULT 0,
    ab_winner text,
    drip_sequence text,
    drip_step integer,
    created_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone
);


--
-- Name: newsletter_campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_campaigns ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.newsletter_campaigns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: newsletter_subscribers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_subscribers (
    id bigint NOT NULL,
    user_id uuid,
    email text NOT NULL,
    locale text DEFAULT 'en'::text,
    subscribed boolean DEFAULT true,
    unsubscribed_at timestamp with time zone,
    preferences jsonb DEFAULT '{}'::jsonb,
    rfm_segment text,
    created_at timestamp with time zone DEFAULT now(),
    confirmation_token text,
    confirmed_at timestamp with time zone
);


--
-- Name: newsletter_subscribers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_subscribers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.newsletter_subscribers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    title text NOT NULL,
    body text,
    data jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_price_cents integer NOT NULL,
    printify_line_item_id character varying(255),
    cost_cents integer,
    external_line_item_id text,
    composition_id uuid,
    CONSTRAINT order_items_cost_cents_non_negative CHECK (((cost_cents IS NULL) OR (cost_cents >= 0))),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT order_items_unit_price_cents_non_negative CHECK ((unit_price_cents >= 0))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    stripe_session_id character varying(255),
    stripe_payment_intent_id character varying(255),
    printify_order_id character varying(255),
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    total_cents integer NOT NULL,
    currency character varying(10) DEFAULT 'EUR'::character varying NOT NULL,
    shipping_address jsonb,
    customer_email character varying(255),
    tracking_number character varying(255),
    tracking_url text,
    carrier character varying(100),
    locale character varying(5) DEFAULT 'en'::bpchar NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    shipped_at timestamp with time zone,
    delivered_at timestamp with time zone,
    printify_status character varying(50),
    printify_cost_cents integer,
    stripe_fee_cents integer,
    gift_message text,
    payment_method character varying(50),
    stripe_refund_id character varying(255),
    refunded_at timestamp with time zone,
    refund_amount_cents integer,
    refund_reason text,
    retry_count integer DEFAULT 0 NOT NULL,
    tenant_id uuid DEFAULT 'f1c548a3-b69d-4328-a372-c4924a660044'::uuid NOT NULL,
    external_order_id text,
    pod_provider character varying(20) DEFAULT 'printify'::character varying NOT NULL,
    pod_cost_cents integer,
    pod_retry_count integer DEFAULT 0 NOT NULL,
    pod_error text,
    pod_last_attempt_at timestamp with time zone,
    admin_notes jsonb DEFAULT '[]'::jsonb,
    coupon_code character varying(50),
    discount_cents integer DEFAULT 0,
    CONSTRAINT orders_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('paid'::character varying)::text, ('submitted'::character varying)::text, ('in_production'::character varying)::text, ('shipped'::character varying)::text, ('delivered'::character varying)::text, ('cancelled'::character varying)::text, ('refunded'::character varying)::text, ('requires_review'::character varying)::text, ('failed'::character varying)::text, ('disputed'::character varying)::text]))),
    CONSTRAINT orders_total_cents_non_negative CHECK ((total_cents >= 0))
);


--
-- Name: COLUMN orders.printify_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.printify_status IS 'Status of the order submission to Printify (submitted, processing, production, shipped, failed, etc.)';


--
-- Name: COLUMN orders.payment_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.payment_method IS 'Payment method type from Stripe (card, crypto, etc.)';


--
-- Name: COLUMN orders.stripe_refund_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.stripe_refund_id IS 'Stripe refund ID (re_xxx) - UNIQUE to prevent duplicate refunds';


--
-- Name: COLUMN orders.refunded_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.refunded_at IS 'Timestamp when the refund was processed';


--
-- Name: COLUMN orders.refund_amount_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.refund_amount_cents IS 'Amount refunded in cents';


--
-- Name: COLUMN orders.refund_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.refund_reason IS 'Reason for the refund (customer request, defect, etc.)';


--
-- Name: COLUMN orders.retry_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orders.retry_count IS 'Number of refund retry attempts (default 0)';


--
-- Name: personalizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.personalizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    product_id uuid NOT NULL,
    variant_id uuid,
    text_content text,
    font_family text DEFAULT 'Inter'::text,
    font_color text DEFAULT '#000000'::text,
    image_url text,
    image_position jsonb DEFAULT '{"x": 0.5, "y": 0.5, "angle": 0, "scale": 1}'::jsonb,
    printify_temp_product_id text,
    preview_url text,
    status text DEFAULT 'draft'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    font_size text DEFAULT 'medium'::text,
    "position" text DEFAULT 'bottom'::text,
    surcharge_amount numeric(10,2) DEFAULT NULL::numeric,
    text_align text DEFAULT 'center'::text,
    provider_temp_product_id text,
    CONSTRAINT personalizations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ready'::text, 'ordered'::text, 'expired'::text])))
);


--
-- Name: price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_history (
    id bigint NOT NULL,
    product_id uuid NOT NULL,
    price numeric NOT NULL,
    quantity_sold integer DEFAULT 0 NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: price_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.price_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: price_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.price_history_id_seq OWNED BY public.price_history.id;


--
-- Name: processed_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processed_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider character varying(255) NOT NULL,
    event_id character varying(255) NOT NULL,
    event_type character varying(255) NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL,
    status_code integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE processed_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.processed_events IS 'Webhook deduplication table - tracks processed events by provider and event_id to prevent duplicate processing';


--
-- Name: product_beliefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_beliefs (
    product_id uuid NOT NULL,
    alpha double precision DEFAULT 1.0 NOT NULL,
    beta double precision DEFAULT 1.0 NOT NULL,
    views_total integer DEFAULT 0 NOT NULL,
    sales_total integer DEFAULT 0 NOT NULL,
    revenue_total_cents integer DEFAULT 0 NOT NULL,
    cogs_total_cents integer DEFAULT 0 NOT NULL,
    sprt_log_lr double precision DEFAULT 0.0 NOT NULL,
    sprt_decision text DEFAULT 'continue'::text NOT NULL,
    lifecycle_status text DEFAULT 'observation'::text NOT NULL,
    last_sale_at timestamp with time zone,
    listed_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_beliefs_lifecycle_status_check CHECK ((lifecycle_status = ANY (ARRAY['observation'::text, 'promote'::text, 'scale'::text, 'delist'::text, 'archive'::text]))),
    CONSTRAINT product_beliefs_sprt_decision_check CHECK ((sprt_decision = ANY (ARRAY['continue'::text, 'viable'::text, 'not_viable'::text])))
);


--
-- Name: product_daily_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_daily_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    metric_date date NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    cart_adds integer DEFAULT 0 NOT NULL,
    wishlist_adds integer DEFAULT 0 NOT NULL,
    orders integer DEFAULT 0 NOT NULL,
    units_sold integer DEFAULT 0 NOT NULL,
    revenue_cents integer DEFAULT 0 NOT NULL,
    cogs_cents integer DEFAULT 0 NOT NULL,
    margin_cents integer GENERATED ALWAYS AS ((revenue_cents - cogs_cents)) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_labels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    label_type character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_labels_label_type_check CHECK (((label_type)::text = ANY (ARRAY[('trending'::character varying)::text, ('bestseller'::character varying)::text, ('new'::character varying)::text, ('sale'::character varying)::text, ('limited'::character varying)::text])))
);


--
-- Name: product_lifecycle_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_lifecycle_decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    decision text NOT NULL,
    reason text,
    agent_name text NOT NULL,
    confidence double precision,
    metrics_snapshot jsonb,
    approval_status text DEFAULT 'auto'::text NOT NULL,
    approved_by text,
    executed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_lifecycle_decisions_approval_status_check CHECK ((approval_status = ANY (ARRAY['auto'::text, 'pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT product_lifecycle_decisions_confidence_check CHECK (((confidence >= (0.0)::double precision) AND (confidence <= (1.0)::double precision))),
    CONSTRAINT product_lifecycle_decisions_decision_check CHECK ((decision = ANY (ARRAY['kill'::text, 'scale'::text, 'iterate'::text, 'hold'::text, 'archive'::text])))
);


--
-- Name: product_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    user_id uuid NOT NULL,
    order_id uuid,
    rating smallint NOT NULL,
    title character varying(200),
    body text,
    images jsonb DEFAULT '[]'::jsonb,
    is_verified_purchase boolean DEFAULT true NOT NULL,
    locale character varying(5) DEFAULT 'en'::bpchar NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    moderation_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    moderation_notes text,
    moderated_by uuid,
    moderated_at timestamp with time zone,
    image_urls jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT product_reviews_moderation_status_check CHECK (((moderation_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text]))),
    CONSTRAINT product_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    printify_variant_id character varying(255),
    title character varying(255) NOT NULL,
    size character varying(50),
    color character varying(50),
    price_cents integer NOT NULL,
    sku character varying(100),
    is_enabled boolean DEFAULT true NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    cost_cents integer,
    image_url text,
    external_variant_id text,
    blank_image_url text,
    color_hex character varying(9),
    stock_quantity integer,
    low_stock_threshold integer DEFAULT 5,
    track_inventory boolean DEFAULT false NOT NULL,
    CONSTRAINT product_variants_cost_cents_non_negative CHECK (((cost_cents IS NULL) OR (cost_cents >= 0))),
    CONSTRAINT product_variants_price_cents_non_negative CHECK ((price_cents >= 0))
);


--
-- Name: COLUMN product_variants.stock_quantity; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.stock_quantity IS 'Current stock for physical products (NULL=unlimited/POD)';


--
-- Name: COLUMN product_variants.low_stock_threshold; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.low_stock_threshold IS 'Alert threshold for low stock notifications';


--
-- Name: COLUMN product_variants.track_inventory; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.track_inventory IS 'true=decrement on sale, false=unlimited (POD products)';


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    printify_id character varying(255),
    title text NOT NULL,
    description text,
    category character varying(100),
    tags text[] DEFAULT '{}'::text[],
    blueprint_id integer,
    print_provider_id integer,
    base_price_cents integer,
    currency character varying(10) DEFAULT 'EUR'::character varying NOT NULL,
    images jsonb DEFAULT '[]'::jsonb,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    avg_rating numeric(2,1) DEFAULT 0,
    review_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    translations jsonb DEFAULT '{}'::jsonb,
    cost_cents integer,
    product_details jsonb DEFAULT '{}'::jsonb,
    category_id uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    admin_edited_at timestamp with time zone,
    last_synced_at timestamp with time zone,
    tenant_id uuid DEFAULT 'f1c548a3-b69d-4328-a372-c4924a660044'::uuid NOT NULL,
    compare_at_price_cents integer,
    branded_hero_url text,
    pod_provider character varying(20) DEFAULT 'printify'::character varying NOT NULL,
    provider_product_id text,
    product_template_id text,
    provider_facility_id text,
    design_templates jsonb,
    slug text NOT NULL,
    meta_title text,
    meta_description text,
    gpsr_info jsonb DEFAULT '{}'::jsonb,
    product_type character varying(20) DEFAULT 'pod'::character varying NOT NULL,
    shipping_weight_grams integer,
    shipping_dimensions jsonb,
    shipping_method character varying(20) DEFAULT 'pod_provider'::character varying,
    digital_files jsonb DEFAULT '[]'::jsonb,
    track_inventory boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_compare_at_price_gt_base CHECK (((compare_at_price_cents IS NULL) OR (compare_at_price_cents > base_price_cents))),
    CONSTRAINT products_base_price_cents_non_negative CHECK (((base_price_cents IS NULL) OR (base_price_cents >= 0))),
    CONSTRAINT products_cost_cents_non_negative CHECK (((cost_cents IS NULL) OR (cost_cents >= 0))),
    CONSTRAINT products_product_type_check CHECK (((product_type)::text = ANY ((ARRAY['pod'::character varying, 'physical'::character varying, 'digital'::character varying])::text[]))),
    CONSTRAINT products_shipping_method_check CHECK (((shipping_method)::text = ANY ((ARRAY['pod_provider'::character varying, 'self_ship'::character varying, 'digital'::character varying, 'pickup'::character varying])::text[]))),
    CONSTRAINT products_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('active'::character varying)::text, ('archived'::character varying)::text, ('deleted'::character varying)::text, ('publishing'::character varying)::text])))
);


--
-- Name: COLUMN products.translations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.translations IS 'Translations for title and description in different locales. Format: {"es": {"title": "...", "description": "..."}, "de": {"title": "...", "description": "..."}}';


--
-- Name: COLUMN products.admin_edited_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.admin_edited_at IS 'Timestamp when admin last edited title, description, or tags (preserves admin edits during sync)';


--
-- Name: COLUMN products.last_synced_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.last_synced_at IS 'Timestamp of last Printify sync (used to determine if admin edits are newer)';


--
-- Name: COLUMN products.compare_at_price_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.compare_at_price_cents IS 'Original price before discount. NULL = no sale.';


--
-- Name: COLUMN products.branded_hero_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.branded_hero_url IS 'Branded hero mockup URL (Supabase Storage). Survives Printify cron sync.';


--
-- Name: COLUMN products.design_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.design_templates IS 'Printful mockup-generator templates: ghost images, print area coords, variant mapping';


--
-- Name: COLUMN products.product_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.product_type IS 'pod=Printful fulfillment, physical=own inventory, digital=downloadable';


--
-- Name: COLUMN products.shipping_weight_grams; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.shipping_weight_grams IS 'Weight in grams for physical products (shipping calc)';


--
-- Name: COLUMN products.shipping_dimensions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.shipping_dimensions IS '{"length_cm", "width_cm", "height_cm"} for physical products';


--
-- Name: COLUMN products.shipping_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.shipping_method IS 'pod_provider=auto via Printful, self_ship=manual, digital=email delivery, pickup=in-store';


--
-- Name: COLUMN products.digital_files; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.digital_files IS '[{"url","filename","size_bytes","mime_type","download_limit"}]';


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent character varying(500),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_id uuid,
    referred_id uuid,
    credits_awarded boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: return_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.return_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    user_id uuid,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    refund_amount_cents integer,
    refund_currency character varying(10) DEFAULT 'eur'::character varying,
    stripe_refund_id character varying(255),
    admin_notes text,
    approved_by uuid,
    approved_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tracking_number text,
    tracking_carrier text,
    customer_shipped_at timestamp with time zone,
    item_received_at timestamp with time zone,
    CONSTRAINT return_requests_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('processing'::character varying)::text, ('completed'::character varying)::text])))
);


--
-- Name: returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    status character varying(30) DEFAULT 'return_requested'::character varying NOT NULL,
    reason text NOT NULL,
    admin_notes text,
    return_tracking_number character varying(255),
    refund_amount_cents integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    CONSTRAINT returns_status_check CHECK (((status)::text = ANY (ARRAY[('return_requested'::character varying)::text, ('return_approved'::character varying)::text, ('item_shipped'::character varying)::text, ('item_received'::character varying)::text, ('return_completed'::character varying)::text, ('rejected'::character varying)::text, ('expired'::character varying)::text])))
);


--
-- Name: TABLE returns; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.returns IS 'Tracks product returns through their complete lifecycle from request to resolution';


--
-- Name: COLUMN returns.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.returns.status IS 'Return status: return_requested, return_approved, item_shipped, item_received, return_completed, rejected, expired';


--
-- Name: COLUMN returns.return_tracking_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.returns.return_tracking_number IS 'Tracking number for the return shipment from customer to warehouse';


--
-- Name: COLUMN returns.resolved_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.returns.resolved_at IS 'Timestamp when return was completed or rejected';


--
-- Name: COLUMN returns.resolved_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.returns.resolved_by IS 'User ID of admin/staff who resolved the return';


--
-- Name: seo_meta_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seo_meta_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    locale character varying(5) NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    keywords text NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT seo_meta_tags_locale_check CHECK (((locale)::text = ANY (ARRAY[('en'::character varying)::text, ('es'::character varying)::text, ('de'::character varying)::text])))
);


--
-- Name: shipping_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label character varying(50),
    full_name character varying(255),
    street_line1 text NOT NULL,
    street_line2 text,
    city character varying(100) NOT NULL,
    state character varying(100),
    postal_code character varying(20) NOT NULL,
    country_code character(2) NOT NULL,
    phone character varying(30),
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shipping_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    country_code character varying(2) NOT NULL,
    zip_pattern character varying(20),
    state_code character varying(5),
    base_rate numeric(10,2) NOT NULL,
    per_item_rate numeric(10,2) DEFAULT 0,
    free_shipping_threshold numeric(10,2),
    estimated_days_min integer DEFAULT 3,
    estimated_days_max integer DEFAULT 7,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: soul_change_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.soul_change_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    proposal_id character varying(36) NOT NULL,
    section character varying(100) NOT NULL,
    old_content text,
    new_content text,
    reasoning text,
    diff text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    reviewed_by character varying(100),
    review_reason text,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone
);


--
-- Name: store_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: store_themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_themes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    category text NOT NULL,
    css_variables jsonb DEFAULT '{}'::jsonb NOT NULL,
    css_variables_dark jsonb DEFAULT '{}'::jsonb NOT NULL,
    fonts jsonb DEFAULT '{"body": "system-ui", "mono": "ui-monospace", "heading": "system-ui"}'::jsonb NOT NULL,
    border_radius text DEFAULT 'medium'::text NOT NULL,
    shadow_preset text DEFAULT 'medium'::text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    is_custom boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid,
    CONSTRAINT store_themes_category_check CHECK ((category = ANY (ARRAY['light'::text, 'dark'::text, 'high_contrast'::text, 'custom'::text, 'eco'::text, 'tech'::text, 'bohemian'::text, 'outdoor'::text, 'premium'::text, 'fun'::text, 'minimal'::text, 'vintage'::text]))),
    CONSTRAINT store_themes_shadow_preset_check CHECK ((shadow_preset = ANY (ARRAY['none'::text, 'small'::text, 'subtle'::text, 'medium'::text, 'large'::text, 'extra_large'::text])))
);


--
-- Name: TABLE store_themes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.store_themes IS 'Theme configurations for the storefront with light/dark mode support';


--
-- Name: COLUMN store_themes.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.store_themes.category IS 'Theme category: light, dark, high_contrast, custom, eco, tech, bohemian, outdoor, premium, fun, minimal, vintage';


--
-- Name: COLUMN store_themes.border_radius; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.store_themes.border_radius IS 'Border radius value: can be a preset (none, small, medium, large, full) or a custom CSS value (e.g., 1rem, 0.75rem)';


--
-- Name: COLUMN store_themes.shadow_preset; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.store_themes.shadow_preset IS 'Shadow preset: none, small, subtle, medium, large, extra_large';


--
-- Name: system_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_events (
    id bigint NOT NULL,
    source text NOT NULL,
    event_type text DEFAULT 'message'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    wake_mode text DEFAULT 'next-heartbeat'::text NOT NULL,
    target_agent text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    dispatched_at timestamp with time zone,
    completed_at timestamp with time zone,
    handled_by text,
    CONSTRAINT system_events_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'dispatched'::text, 'completed'::text, 'failed'::text]))),
    CONSTRAINT system_events_wake_mode_check CHECK ((wake_mode = ANY (ARRAY['now'::text, 'next-heartbeat'::text])))
);


--
-- Name: system_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_events_id_seq OWNED BY public.system_events.id;


--
-- Name: telegram_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    update_id bigint NOT NULL,
    message_id bigint NOT NULL,
    user_id text NOT NULL,
    username text,
    first_name text NOT NULL,
    last_name text,
    chat_id text NOT NULL,
    text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE telegram_messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.telegram_messages IS 'Stores all incoming Telegram bot messages';


--
-- Name: tenant_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(20) DEFAULT 'member'::character varying NOT NULL,
    invited_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    CONSTRAINT tenant_members_role_check CHECK (((role)::text = ANY (ARRAY[('owner'::character varying)::text, ('admin'::character varying)::text, ('editor'::character varying)::text, ('viewer'::character varying)::text])))
);


--
-- Name: TABLE tenant_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenant_members IS 'Team members with role-based access to tenants';


--
-- Name: COLUMN tenant_members.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_members.role IS 'Access level: owner (full), admin (manage), editor (create/edit), viewer (read-only)';


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    owner_id uuid NOT NULL,
    stripe_customer_id character varying(255),
    stripe_subscription_id character varying(255),
    subscription_tier character varying(20) DEFAULT 'starter'::character varying NOT NULL,
    subscription_status character varying(20) DEFAULT 'none'::character varying NOT NULL,
    subscription_period_end timestamp with time zone,
    grace_period_ends_at timestamp with time zone,
    max_products integer DEFAULT 25 NOT NULL,
    max_orders_per_month integer DEFAULT 50 NOT NULL,
    max_team_members integer DEFAULT 1 NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    domain text,
    plan text DEFAULT 'free'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    CONSTRAINT tenants_subscription_status_check CHECK (((subscription_status)::text = ANY (ARRAY[('none'::character varying)::text, ('trialing'::character varying)::text, ('active'::character varying)::text, ('past_due'::character varying)::text, ('canceled'::character varying)::text, ('paused'::character varying)::text]))),
    CONSTRAINT tenants_subscription_tier_check CHECK (((subscription_tier)::text = ANY (ARRAY[('starter'::character varying)::text, ('pro'::character varying)::text, ('enterprise'::character varying)::text])))
);


--
-- Name: TABLE tenants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenants IS 'Multi-tenant SaaS structure for POD stores with Stripe subscription management';


--
-- Name: COLUMN tenants.subscription_tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.subscription_tier IS 'Starter (free), Pro ($29/mo), or Enterprise ($99/mo)';


--
-- Name: COLUMN tenants.subscription_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.subscription_status IS 'Subscription lifecycle status per Stripe';


--
-- Name: COLUMN tenants.settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.settings IS 'Tenant-specific configuration (JSON)';


--
-- Name: translations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.translations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    namespace character varying(50) NOT NULL,
    key character varying(255) NOT NULL,
    locale character varying(5) NOT NULL,
    value text NOT NULL,
    is_auto_translated boolean DEFAULT false NOT NULL,
    reviewed_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trending_products; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.trending_products AS
 SELECT p.id,
    p.title,
    p.avg_rating,
    (COALESCE(sum(pdm.views), (0)::bigint))::integer AS views_7d,
    (COALESCE(sum(pdm.orders), (0)::bigint))::integer AS orders_7d,
    (((COALESCE(sum(pdm.views), (0)::bigint))::numeric * 0.3) + ((COALESCE(sum(pdm.orders), (0)::bigint))::numeric * 0.7)) AS weighted_score
   FROM (public.products p
     LEFT JOIN public.product_daily_metrics pdm ON (((p.id = pdm.product_id) AND (pdm.metric_date >= (CURRENT_DATE - '7 days'::interval)))))
  WHERE ((p.status)::text = 'active'::text)
  GROUP BY p.id, p.title, p.avg_rating
  ORDER BY (((COALESCE(sum(pdm.views), (0)::bigint))::numeric * 0.3) + ((COALESCE(sum(pdm.orders), (0)::bigint))::numeric * 0.7)) DESC
  WITH NO DATA;


--
-- Name: user_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    consent_type text NOT NULL,
    granted boolean NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_consents_consent_type_check CHECK ((consent_type = ANY (ARRAY['cookies'::text, 'marketing'::text, 'analytics'::text, 'functional'::text, 'personalization'::text])))
);


--
-- Name: TABLE user_consents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_consents IS 'GDPR consent tracking - records user consent grants and withdrawals';


--
-- Name: COLUMN user_consents.consent_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_consents.consent_type IS 'Type of consent: cookies, marketing, analytics, functional, personalization';


--
-- Name: COLUMN user_consents.granted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_consents.granted IS 'true = consent granted, false = consent withdrawn';


--
-- Name: COLUMN user_consents."timestamp"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_consents."timestamp" IS 'When the consent action occurred';


--
-- Name: COLUMN user_consents.ip_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_consents.ip_address IS 'IP address of the user when consent was given/withdrawn';


--
-- Name: COLUMN user_consents.user_agent; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_consents.user_agent IS 'User agent string for audit trail';


--
-- Name: user_design_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_design_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    original_url text NOT NULL,
    processed_url text,
    thumbnail_url text,
    filename text,
    mime_type text,
    file_size_bytes integer,
    width integer,
    height integer,
    has_transparency boolean DEFAULT false,
    source text DEFAULT 'upload'::text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_design_assets_source_check CHECK ((source = ANY (ARRAY['upload'::text, 'ai_generation'::text, 'chat'::text])))
);


--
-- Name: user_messaging_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_messaging_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    platform character varying(20) NOT NULL,
    platform_user_id character varying(255) NOT NULL,
    platform_username character varying(255),
    is_admin_mode boolean DEFAULT false NOT NULL,
    linked_at timestamp with time zone DEFAULT now() NOT NULL,
    verified boolean DEFAULT false
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid
);


--
-- Name: TABLE user_roles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_roles IS 'Join table linking users to their assigned admin roles';


--
-- Name: user_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier character varying(255) NOT NULL,
    action character varying(50) NOT NULL,
    period character varying(10) NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255),
    name character varying(255),
    role character varying(20) DEFAULT 'customer'::character varying NOT NULL,
    avatar_url text,
    locale character varying(5) DEFAULT 'en'::bpchar NOT NULL,
    currency character varying(3) DEFAULT 'EUR'::character varying NOT NULL,
    phone character varying(30),
    email_verified boolean DEFAULT false NOT NULL,
    notification_preferences jsonb DEFAULT '{"sms": false, "push": true, "email": true}'::jsonb NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone,
    deleted_at timestamp with time zone,
    tier character varying(20) DEFAULT 'free'::character varying,
    credit_balance integer DEFAULT 0,
    stripe_customer_id character varying(255),
    stripe_subscription_id character varying(255),
    subscription_status character varying(20) DEFAULT 'none'::character varying,
    subscription_period_end timestamp with time zone,
    must_change_password boolean DEFAULT false,
    deletion_requested_at timestamp with time zone,
    referral_code character varying(20),
    tenant_id uuid DEFAULT 'f1c548a3-b69d-4328-a372-c4924a660044'::uuid NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    account_status character varying(20) DEFAULT 'active'::character varying,
    CONSTRAINT users_account_status_check CHECK (((account_status)::text = ANY (ARRAY[('active'::character varying)::text, ('disabled'::character varying)::text, ('suspended'::character varying)::text]))),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY (ARRAY[('customer'::character varying)::text, ('admin'::character varying)::text]))),
    CONSTRAINT users_subscription_status_check CHECK (((subscription_status)::text = ANY (ARRAY[('none'::character varying)::text, ('active'::character varying)::text, ('cancelled'::character varying)::text, ('past_due'::character varying)::text]))),
    CONSTRAINT users_tier_check CHECK (((tier)::text = ANY (ARRAY[('free'::character varying)::text, ('premium'::character varying)::text])))
);


--
-- Name: COLUMN users.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.id IS 'References auth.users(id). Synchronized via on_auth_user_created trigger.';


--
-- Name: COLUMN users.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.deleted_at IS 'Timestamp when account was soft-deleted (30-day grace period starts here)';


--
-- Name: COLUMN users.must_change_password; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.must_change_password IS 'Security flag: User must change password on next login. Used for default/compromised passwords.';


--
-- Name: COLUMN users.deletion_requested_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.deletion_requested_at IS 'Timestamp when user requested account deletion (soft delete marker)';


--
-- Name: webhook_dead_letters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_dead_letters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    event_type text NOT NULL,
    event_id text,
    resource_id text,
    payload jsonb NOT NULL,
    error text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    retried_at timestamp with time zone,
    retry_count integer DEFAULT 0
);


--
-- Name: whatsapp_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id text NOT NULL,
    from_number text NOT NULL,
    from_name text,
    text text,
    media_url text,
    media_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE whatsapp_messages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.whatsapp_messages IS 'Stores all incoming WhatsApp Business API messages';


--
-- Name: wishlist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wishlist_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: wishlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(100) DEFAULT 'My Wishlist'::character varying NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    share_token character varying(64),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id uuid DEFAULT 'f1c548a3-b69d-4328-a372-c4924a660044'::uuid NOT NULL
);


--
-- Name: agent_events_y2026m02; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events ATTACH PARTITION public.agent_events_y2026m02 FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');


--
-- Name: agent_events_y2026m03; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events ATTACH PARTITION public.agent_events_y2026m03 FOR VALUES FROM ('2026-03-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');


--
-- Name: agent_events_y2026m04; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events ATTACH PARTITION public.agent_events_y2026m04 FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-05-01 00:00:00+00');


--
-- Name: agent_events_y2026m05; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events ATTACH PARTITION public.agent_events_y2026m05 FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');


--
-- Name: agent_events_y2026m06; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events ATTACH PARTITION public.agent_events_y2026m06 FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');


--
-- Name: agent_events_y2026m07; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events ATTACH PARTITION public.agent_events_y2026m07 FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');


--
-- Name: agent_events_y2026m08; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events ATTACH PARTITION public.agent_events_y2026m08 FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');


--
-- Name: audit_log_y2026m02; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m02 FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');


--
-- Name: audit_log_y2026m03; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m03 FOR VALUES FROM ('2026-03-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');


--
-- Name: audit_log_y2026m04; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m04 FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-05-01 00:00:00+00');


--
-- Name: audit_log_y2026m05; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m05 FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');


--
-- Name: audit_log_y2026m06; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m06 FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');


--
-- Name: audit_log_y2026m07; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m07 FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');


--
-- Name: audit_log_y2026m08; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m08 FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');


--
-- Name: messages_y2026m02; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ATTACH PARTITION public.messages_y2026m02 FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');


--
-- Name: messages_y2026m03; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ATTACH PARTITION public.messages_y2026m03 FOR VALUES FROM ('2026-03-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');


--
-- Name: messages_y2026m04; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ATTACH PARTITION public.messages_y2026m04 FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-05-01 00:00:00+00');


--
-- Name: messages_y2026m05; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ATTACH PARTITION public.messages_y2026m05 FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');


--
-- Name: messages_y2026m06; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ATTACH PARTITION public.messages_y2026m06 FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');


--
-- Name: messages_y2026m07; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ATTACH PARTITION public.messages_y2026m07 FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');


--
-- Name: messages_y2026m08; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ATTACH PARTITION public.messages_y2026m08 FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');


--
-- Name: ab_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ab_events ALTER COLUMN id SET DEFAULT nextval('public.ab_events_id_seq'::regclass);


--
-- Name: agent_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events ALTER COLUMN id SET DEFAULT nextval('public.agent_events_new_id_seq'::regclass);


--
-- Name: association_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_rules ALTER COLUMN id SET DEFAULT nextval('public.association_rules_id_seq'::regclass);


--
-- Name: demand_forecasts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demand_forecasts ALTER COLUMN id SET DEFAULT nextval('public.demand_forecasts_id_seq'::regclass);


--
-- Name: price_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history ALTER COLUMN id SET DEFAULT nextval('public.price_history_id_seq'::regclass);


--
-- Name: system_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_events ALTER COLUMN id SET DEFAULT nextval('public.system_events_id_seq'::regclass);


--
-- Name: ab_events ab_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ab_events
    ADD CONSTRAINT ab_events_pkey PRIMARY KEY (id);


--
-- Name: ab_experiments ab_experiments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ab_experiments
    ADD CONSTRAINT ab_experiments_pkey PRIMARY KEY (id);


--
-- Name: abandoned_carts abandoned_carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abandoned_carts
    ADD CONSTRAINT abandoned_carts_pkey PRIMARY KEY (id);


--
-- Name: admin_roles admin_roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_roles
    ADD CONSTRAINT admin_roles_name_key UNIQUE (name);


--
-- Name: admin_roles admin_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_roles
    ADD CONSTRAINT admin_roles_pkey PRIMARY KEY (id);


--
-- Name: admin_settings admin_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (id);


--
-- Name: agent_daily_costs agent_daily_costs_agent_name_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_daily_costs
    ADD CONSTRAINT agent_daily_costs_agent_name_date_key UNIQUE (agent_name, date);


--
-- Name: agent_daily_costs agent_daily_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_daily_costs
    ADD CONSTRAINT agent_daily_costs_pkey PRIMARY KEY (id);


--
-- Name: agent_events agent_events_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events
    ADD CONSTRAINT agent_events_new_pkey PRIMARY KEY (id, created_at);


--
-- Name: agent_events_y2026m02 agent_events_y2026m02_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events_y2026m02
    ADD CONSTRAINT agent_events_y2026m02_pkey PRIMARY KEY (id, created_at);


--
-- Name: agent_events_y2026m03 agent_events_y2026m03_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events_y2026m03
    ADD CONSTRAINT agent_events_y2026m03_pkey PRIMARY KEY (id, created_at);


--
-- Name: agent_events_y2026m04 agent_events_y2026m04_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events_y2026m04
    ADD CONSTRAINT agent_events_y2026m04_pkey PRIMARY KEY (id, created_at);


--
-- Name: agent_events_y2026m05 agent_events_y2026m05_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events_y2026m05
    ADD CONSTRAINT agent_events_y2026m05_pkey PRIMARY KEY (id, created_at);


--
-- Name: agent_events_y2026m06 agent_events_y2026m06_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events_y2026m06
    ADD CONSTRAINT agent_events_y2026m06_pkey PRIMARY KEY (id, created_at);


--
-- Name: agent_events_y2026m07 agent_events_y2026m07_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events_y2026m07
    ADD CONSTRAINT agent_events_y2026m07_pkey PRIMARY KEY (id, created_at);


--
-- Name: agent_events_y2026m08 agent_events_y2026m08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_events_y2026m08
    ADD CONSTRAINT agent_events_y2026m08_pkey PRIMARY KEY (id, created_at);


--
-- Name: agent_sessions agent_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_sessions
    ADD CONSTRAINT agent_sessions_pkey PRIMARY KEY (id);


--
-- Name: ai_generations ai_generations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generations
    ADD CONSTRAINT ai_generations_pkey PRIMARY KEY (id);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: association_rules association_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.association_rules
    ADD CONSTRAINT association_rules_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_new_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m02 audit_log_y2026m02_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m02
    ADD CONSTRAINT audit_log_y2026m02_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m03 audit_log_y2026m03_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m03
    ADD CONSTRAINT audit_log_y2026m03_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m04 audit_log_y2026m04_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m04
    ADD CONSTRAINT audit_log_y2026m04_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m05 audit_log_y2026m05_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m05
    ADD CONSTRAINT audit_log_y2026m05_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m06 audit_log_y2026m06_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m06
    ADD CONSTRAINT audit_log_y2026m06_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m07 audit_log_y2026m07_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m07
    ADD CONSTRAINT audit_log_y2026m07_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m08 audit_log_y2026m08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m08
    ADD CONSTRAINT audit_log_y2026m08_pkey PRIMARY KEY (id, created_at);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- Name: brand_config brand_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brand_config
    ADD CONSTRAINT brand_config_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: collection_products collection_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_products
    ADD CONSTRAINT collection_products_pkey PRIMARY KEY (collection_id, product_id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: collections collections_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_slug_key UNIQUE (slug);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: coupon_uses coupon_uses_coupon_id_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_uses
    ADD CONSTRAINT coupon_uses_coupon_id_order_id_key UNIQUE (coupon_id, order_id);


--
-- Name: coupon_uses coupon_uses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_uses
    ADD CONSTRAINT coupon_uses_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: credit_transactions credit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_pkey PRIMARY KEY (id);


--
-- Name: cron_runs cron_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cron_runs
    ADD CONSTRAINT cron_runs_pkey PRIMARY KEY (id);


--
-- Name: customer_segments customer_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_segments
    ADD CONSTRAINT customer_segments_pkey PRIMARY KEY (customer_id);


--
-- Name: daily_portfolio_metrics daily_portfolio_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_portfolio_metrics
    ADD CONSTRAINT daily_portfolio_metrics_pkey PRIMARY KEY (date);


--
-- Name: demand_forecasts demand_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demand_forecasts
    ADD CONSTRAINT demand_forecasts_pkey PRIMARY KEY (id);


--
-- Name: demand_forecasts demand_forecasts_product_id_forecast_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demand_forecasts
    ADD CONSTRAINT demand_forecasts_product_id_forecast_date_key UNIQUE (product_id, forecast_date);


--
-- Name: design_clipart design_clipart_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_clipart
    ADD CONSTRAINT design_clipart_pkey PRIMARY KEY (id);


--
-- Name: design_compositions design_compositions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_compositions
    ADD CONSTRAINT design_compositions_pkey PRIMARY KEY (id);


--
-- Name: design_sessions design_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_sessions
    ADD CONSTRAINT design_sessions_pkey PRIMARY KEY (id);


--
-- Name: design_templates_library design_templates_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_templates_library
    ADD CONSTRAINT design_templates_library_pkey PRIMARY KEY (id);


--
-- Name: designs designs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designs
    ADD CONSTRAINT designs_pkey PRIMARY KEY (id);


--
-- Name: download_tokens download_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.download_tokens
    ADD CONSTRAINT download_tokens_pkey PRIMARY KEY (id);


--
-- Name: download_tokens download_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.download_tokens
    ADD CONSTRAINT download_tokens_token_key UNIQUE (token);


--
-- Name: drip_queue drip_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drip_queue
    ADD CONSTRAINT drip_queue_pkey PRIMARY KEY (id);


--
-- Name: error_logs error_logs_error_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_error_hash_key UNIQUE (error_hash);


--
-- Name: error_logs error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_pkey PRIMARY KEY (id);


--
-- Name: heartbeat_events heartbeat_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.heartbeat_events
    ADD CONSTRAINT heartbeat_events_pkey PRIMARY KEY (id);


--
-- Name: hero_campaigns hero_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hero_campaigns
    ADD CONSTRAINT hero_campaigns_pkey PRIMARY KEY (id);


--
-- Name: hero_campaigns hero_campaigns_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hero_campaigns
    ADD CONSTRAINT hero_campaigns_slug_key UNIQUE (slug);


--
-- Name: legal_page_versions legal_page_versions_legal_page_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legal_page_versions
    ADD CONSTRAINT legal_page_versions_legal_page_id_version_number_key UNIQUE (legal_page_id, version_number);


--
-- Name: legal_page_versions legal_page_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legal_page_versions
    ADD CONSTRAINT legal_page_versions_pkey PRIMARY KEY (id);


--
-- Name: legal_pages legal_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legal_pages
    ADD CONSTRAINT legal_pages_pkey PRIMARY KEY (id);


--
-- Name: legal_pages legal_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legal_pages
    ADD CONSTRAINT legal_pages_slug_key UNIQUE (slug);


--
-- Name: legal_settings legal_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legal_settings
    ADD CONSTRAINT legal_settings_pkey PRIMARY KEY (id);


--
-- Name: marketing_content marketing_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_content
    ADD CONSTRAINT marketing_content_pkey PRIMARY KEY (id);


--
-- Name: message_feedback message_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT message_feedback_pkey PRIMARY KEY (id);


--
-- Name: messages messages_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_new_pkey PRIMARY KEY (id, created_at);


--
-- Name: messages_y2026m02 messages_y2026m02_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages_y2026m02
    ADD CONSTRAINT messages_y2026m02_pkey PRIMARY KEY (id, created_at);


--
-- Name: messages_y2026m03 messages_y2026m03_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages_y2026m03
    ADD CONSTRAINT messages_y2026m03_pkey PRIMARY KEY (id, created_at);


--
-- Name: messages_y2026m04 messages_y2026m04_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages_y2026m04
    ADD CONSTRAINT messages_y2026m04_pkey PRIMARY KEY (id, created_at);


--
-- Name: messages_y2026m05 messages_y2026m05_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages_y2026m05
    ADD CONSTRAINT messages_y2026m05_pkey PRIMARY KEY (id, created_at);


--
-- Name: messages_y2026m06 messages_y2026m06_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages_y2026m06
    ADD CONSTRAINT messages_y2026m06_pkey PRIMARY KEY (id, created_at);


--
-- Name: messages_y2026m07 messages_y2026m07_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages_y2026m07
    ADD CONSTRAINT messages_y2026m07_pkey PRIMARY KEY (id, created_at);


--
-- Name: messages_y2026m08 messages_y2026m08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages_y2026m08
    ADD CONSTRAINT messages_y2026m08_pkey PRIMARY KEY (id, created_at);


--
-- Name: messaging_channels messaging_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_channels
    ADD CONSTRAINT messaging_channels_pkey PRIMARY KEY (id);


--
-- Name: messaging_conversations messaging_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_conversations
    ADD CONSTRAINT messaging_conversations_pkey PRIMARY KEY (id);


--
-- Name: newsletter_campaigns newsletter_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_campaigns
    ADD CONSTRAINT newsletter_campaigns_pkey PRIMARY KEY (id);


--
-- Name: newsletter_subscribers newsletter_subscribers_confirmation_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_confirmation_token_key UNIQUE (confirmation_token);


--
-- Name: newsletter_subscribers newsletter_subscribers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_email_key UNIQUE (email);


--
-- Name: newsletter_subscribers newsletter_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: orders orders_stripe_refund_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_stripe_refund_id_key UNIQUE (stripe_refund_id);


--
-- Name: personalizations personalizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personalizations
    ADD CONSTRAINT personalizations_pkey PRIMARY KEY (id);


--
-- Name: price_history price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);


--
-- Name: processed_events processed_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_events
    ADD CONSTRAINT processed_events_pkey PRIMARY KEY (id);


--
-- Name: product_beliefs product_beliefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_beliefs
    ADD CONSTRAINT product_beliefs_pkey PRIMARY KEY (product_id);


--
-- Name: product_daily_metrics product_daily_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_daily_metrics
    ADD CONSTRAINT product_daily_metrics_pkey PRIMARY KEY (id);


--
-- Name: product_daily_metrics product_daily_metrics_product_id_metric_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_daily_metrics
    ADD CONSTRAINT product_daily_metrics_product_id_metric_date_key UNIQUE (product_id, metric_date);


--
-- Name: product_labels product_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_labels
    ADD CONSTRAINT product_labels_pkey PRIMARY KEY (id);


--
-- Name: product_labels product_labels_product_id_label_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_labels
    ADD CONSTRAINT product_labels_product_id_label_type_key UNIQUE (product_id, label_type);


--
-- Name: product_lifecycle_decisions product_lifecycle_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_lifecycle_decisions
    ADD CONSTRAINT product_lifecycle_decisions_pkey PRIMARY KEY (id);


--
-- Name: product_reviews product_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_product_printify_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_printify_unique UNIQUE (product_id, printify_variant_id);


--
-- Name: product_variants product_variants_provider_variant_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_provider_variant_unique UNIQUE (product_id, external_variant_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_printify_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_printify_id_key UNIQUE (printify_id);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_referred_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_id_key UNIQUE (referred_id);


--
-- Name: return_requests return_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_pkey PRIMARY KEY (id);


--
-- Name: returns returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_pkey PRIMARY KEY (id);


--
-- Name: seo_meta_tags seo_meta_tags_locale_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_meta_tags
    ADD CONSTRAINT seo_meta_tags_locale_key UNIQUE (locale);


--
-- Name: seo_meta_tags seo_meta_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_meta_tags
    ADD CONSTRAINT seo_meta_tags_pkey PRIMARY KEY (id);


--
-- Name: shipping_addresses shipping_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_addresses
    ADD CONSTRAINT shipping_addresses_pkey PRIMARY KEY (id);


--
-- Name: shipping_zones shipping_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_zones
    ADD CONSTRAINT shipping_zones_pkey PRIMARY KEY (id);


--
-- Name: soul_change_log soul_change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soul_change_log
    ADD CONSTRAINT soul_change_log_pkey PRIMARY KEY (id);


--
-- Name: store_settings store_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_pkey PRIMARY KEY (key);


--
-- Name: store_themes store_themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_themes
    ADD CONSTRAINT store_themes_pkey PRIMARY KEY (id);


--
-- Name: store_themes store_themes_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_themes
    ADD CONSTRAINT store_themes_slug_key UNIQUE (slug);


--
-- Name: system_events system_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_events
    ADD CONSTRAINT system_events_pkey PRIMARY KEY (id);


--
-- Name: telegram_messages telegram_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_messages
    ADD CONSTRAINT telegram_messages_pkey PRIMARY KEY (id);


--
-- Name: telegram_messages telegram_messages_update_id_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_messages
    ADD CONSTRAINT telegram_messages_update_id_message_id_key UNIQUE (update_id, message_id);


--
-- Name: tenant_configs tenant_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_configs
    ADD CONSTRAINT tenant_configs_pkey PRIMARY KEY (id);


--
-- Name: tenant_configs tenant_configs_tenant_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_configs
    ADD CONSTRAINT tenant_configs_tenant_id_key_key UNIQUE (tenant_id, key);


--
-- Name: tenant_members tenant_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_members
    ADD CONSTRAINT tenant_members_pkey PRIMARY KEY (id);


--
-- Name: tenant_members tenant_members_tenant_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_members
    ADD CONSTRAINT tenant_members_tenant_id_user_id_key UNIQUE (tenant_id, user_id);


--
-- Name: tenants tenants_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_domain_key UNIQUE (domain);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: translations translations_namespace_key_locale_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translations
    ADD CONSTRAINT translations_namespace_key_locale_key UNIQUE (namespace, key, locale);


--
-- Name: translations translations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translations
    ADD CONSTRAINT translations_pkey PRIMARY KEY (id);


--
-- Name: user_consents user_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_consents
    ADD CONSTRAINT user_consents_pkey PRIMARY KEY (id);


--
-- Name: user_design_assets user_design_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_design_assets
    ADD CONSTRAINT user_design_assets_pkey PRIMARY KEY (id);


--
-- Name: user_messaging_links user_messaging_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_messaging_links
    ADD CONSTRAINT user_messaging_links_pkey PRIMARY KEY (id);


--
-- Name: user_messaging_links user_messaging_links_platform_platform_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_messaging_links
    ADD CONSTRAINT user_messaging_links_platform_platform_user_id_key UNIQUE (platform, platform_user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);


--
-- Name: user_usage user_usage_identifier_action_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_usage
    ADD CONSTRAINT user_usage_identifier_action_period_key UNIQUE (identifier, action, period);


--
-- Name: user_usage user_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_usage
    ADD CONSTRAINT user_usage_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);


--
-- Name: webhook_dead_letters webhook_dead_letters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_dead_letters
    ADD CONSTRAINT webhook_dead_letters_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_messages whatsapp_messages_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_message_id_key UNIQUE (message_id);


--
-- Name: whatsapp_messages whatsapp_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_messages
    ADD CONSTRAINT whatsapp_messages_pkey PRIMARY KEY (id);


--
-- Name: wishlist_items wishlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_pkey PRIMARY KEY (id);


--
-- Name: wishlist_items wishlist_items_wishlist_id_product_id_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_wishlist_id_product_id_variant_id_key UNIQUE (wishlist_id, product_id, variant_id);


--
-- Name: wishlists wishlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_pkey PRIMARY KEY (id);


--
-- Name: wishlists wishlists_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_share_token_key UNIQUE (share_token);


--
-- Name: idx_agent_events_agent_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_events_agent_created ON ONLY public.agent_events USING btree (agent_name, created_at DESC);


--
-- Name: agent_events_y2026m02_agent_name_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m02_agent_name_created_at_idx ON public.agent_events_y2026m02 USING btree (agent_name, created_at DESC);


--
-- Name: idx_agent_events_agent_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_events_agent_name ON ONLY public.agent_events USING btree (agent_name);


--
-- Name: agent_events_y2026m02_agent_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m02_agent_name_idx ON public.agent_events_y2026m02 USING btree (agent_name);


--
-- Name: idx_agent_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_events_created ON ONLY public.agent_events USING btree (created_at DESC);


--
-- Name: agent_events_y2026m02_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m02_created_at_idx ON public.agent_events_y2026m02 USING btree (created_at DESC);


--
-- Name: idx_agent_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_events_type ON ONLY public.agent_events USING btree (event_type);


--
-- Name: agent_events_y2026m02_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m02_event_type_idx ON public.agent_events_y2026m02 USING btree (event_type);


--
-- Name: idx_agent_events_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_events_session ON ONLY public.agent_events USING btree (session_id);


--
-- Name: agent_events_y2026m02_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m02_session_id_idx ON public.agent_events_y2026m02 USING btree (session_id);


--
-- Name: agent_events_y2026m03_agent_name_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m03_agent_name_created_at_idx ON public.agent_events_y2026m03 USING btree (agent_name, created_at DESC);


--
-- Name: agent_events_y2026m03_agent_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m03_agent_name_idx ON public.agent_events_y2026m03 USING btree (agent_name);


--
-- Name: agent_events_y2026m03_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m03_created_at_idx ON public.agent_events_y2026m03 USING btree (created_at DESC);


--
-- Name: agent_events_y2026m03_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m03_event_type_idx ON public.agent_events_y2026m03 USING btree (event_type);


--
-- Name: agent_events_y2026m03_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m03_session_id_idx ON public.agent_events_y2026m03 USING btree (session_id);


--
-- Name: agent_events_y2026m04_agent_name_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m04_agent_name_created_at_idx ON public.agent_events_y2026m04 USING btree (agent_name, created_at DESC);


--
-- Name: agent_events_y2026m04_agent_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m04_agent_name_idx ON public.agent_events_y2026m04 USING btree (agent_name);


--
-- Name: agent_events_y2026m04_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m04_created_at_idx ON public.agent_events_y2026m04 USING btree (created_at DESC);


--
-- Name: agent_events_y2026m04_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m04_event_type_idx ON public.agent_events_y2026m04 USING btree (event_type);


--
-- Name: agent_events_y2026m04_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m04_session_id_idx ON public.agent_events_y2026m04 USING btree (session_id);


--
-- Name: agent_events_y2026m05_agent_name_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m05_agent_name_created_at_idx ON public.agent_events_y2026m05 USING btree (agent_name, created_at DESC);


--
-- Name: agent_events_y2026m05_agent_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m05_agent_name_idx ON public.agent_events_y2026m05 USING btree (agent_name);


--
-- Name: agent_events_y2026m05_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m05_created_at_idx ON public.agent_events_y2026m05 USING btree (created_at DESC);


--
-- Name: agent_events_y2026m05_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m05_event_type_idx ON public.agent_events_y2026m05 USING btree (event_type);


--
-- Name: agent_events_y2026m05_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m05_session_id_idx ON public.agent_events_y2026m05 USING btree (session_id);


--
-- Name: agent_events_y2026m06_agent_name_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m06_agent_name_created_at_idx ON public.agent_events_y2026m06 USING btree (agent_name, created_at DESC);


--
-- Name: agent_events_y2026m06_agent_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m06_agent_name_idx ON public.agent_events_y2026m06 USING btree (agent_name);


--
-- Name: agent_events_y2026m06_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m06_created_at_idx ON public.agent_events_y2026m06 USING btree (created_at DESC);


--
-- Name: agent_events_y2026m06_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m06_event_type_idx ON public.agent_events_y2026m06 USING btree (event_type);


--
-- Name: agent_events_y2026m06_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m06_session_id_idx ON public.agent_events_y2026m06 USING btree (session_id);


--
-- Name: agent_events_y2026m07_agent_name_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m07_agent_name_created_at_idx ON public.agent_events_y2026m07 USING btree (agent_name, created_at DESC);


--
-- Name: agent_events_y2026m07_agent_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m07_agent_name_idx ON public.agent_events_y2026m07 USING btree (agent_name);


--
-- Name: agent_events_y2026m07_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m07_created_at_idx ON public.agent_events_y2026m07 USING btree (created_at DESC);


--
-- Name: agent_events_y2026m07_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m07_event_type_idx ON public.agent_events_y2026m07 USING btree (event_type);


--
-- Name: agent_events_y2026m07_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m07_session_id_idx ON public.agent_events_y2026m07 USING btree (session_id);


--
-- Name: agent_events_y2026m08_agent_name_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m08_agent_name_created_at_idx ON public.agent_events_y2026m08 USING btree (agent_name, created_at DESC);


--
-- Name: agent_events_y2026m08_agent_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m08_agent_name_idx ON public.agent_events_y2026m08 USING btree (agent_name);


--
-- Name: agent_events_y2026m08_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m08_created_at_idx ON public.agent_events_y2026m08 USING btree (created_at DESC);


--
-- Name: agent_events_y2026m08_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m08_event_type_idx ON public.agent_events_y2026m08 USING btree (event_type);


--
-- Name: agent_events_y2026m08_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_events_y2026m08_session_id_idx ON public.agent_events_y2026m08 USING btree (session_id);


--
-- Name: idx_audit_log_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_actor ON ONLY public.audit_log USING btree (actor_type, actor_id);


--
-- Name: audit_log_y2026m02_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m02_actor_type_actor_id_idx ON public.audit_log_y2026m02 USING btree (actor_type, actor_id);


--
-- Name: idx_audit_log_created_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created_actor ON ONLY public.audit_log USING btree (created_at DESC, actor_type, actor_id);


--
-- Name: audit_log_y2026m02_created_at_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m02_created_at_actor_type_actor_id_idx ON public.audit_log_y2026m02 USING btree (created_at DESC, actor_type, actor_id);


--
-- Name: idx_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created ON ONLY public.audit_log USING btree (created_at DESC);


--
-- Name: audit_log_y2026m02_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m02_created_at_idx ON public.audit_log_y2026m02 USING btree (created_at DESC);


--
-- Name: idx_audit_log_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_resource ON ONLY public.audit_log USING btree (resource_type, resource_id);


--
-- Name: audit_log_y2026m02_resource_type_resource_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m02_resource_type_resource_id_idx ON public.audit_log_y2026m02 USING btree (resource_type, resource_id);


--
-- Name: audit_log_y2026m03_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m03_actor_type_actor_id_idx ON public.audit_log_y2026m03 USING btree (actor_type, actor_id);


--
-- Name: audit_log_y2026m03_created_at_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m03_created_at_actor_type_actor_id_idx ON public.audit_log_y2026m03 USING btree (created_at DESC, actor_type, actor_id);


--
-- Name: audit_log_y2026m03_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m03_created_at_idx ON public.audit_log_y2026m03 USING btree (created_at DESC);


--
-- Name: audit_log_y2026m03_resource_type_resource_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m03_resource_type_resource_id_idx ON public.audit_log_y2026m03 USING btree (resource_type, resource_id);


--
-- Name: audit_log_y2026m04_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m04_actor_type_actor_id_idx ON public.audit_log_y2026m04 USING btree (actor_type, actor_id);


--
-- Name: audit_log_y2026m04_created_at_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m04_created_at_actor_type_actor_id_idx ON public.audit_log_y2026m04 USING btree (created_at DESC, actor_type, actor_id);


--
-- Name: audit_log_y2026m04_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m04_created_at_idx ON public.audit_log_y2026m04 USING btree (created_at DESC);


--
-- Name: audit_log_y2026m04_resource_type_resource_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m04_resource_type_resource_id_idx ON public.audit_log_y2026m04 USING btree (resource_type, resource_id);


--
-- Name: audit_log_y2026m05_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m05_actor_type_actor_id_idx ON public.audit_log_y2026m05 USING btree (actor_type, actor_id);


--
-- Name: audit_log_y2026m05_created_at_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m05_created_at_actor_type_actor_id_idx ON public.audit_log_y2026m05 USING btree (created_at DESC, actor_type, actor_id);


--
-- Name: audit_log_y2026m05_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m05_created_at_idx ON public.audit_log_y2026m05 USING btree (created_at DESC);


--
-- Name: audit_log_y2026m05_resource_type_resource_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m05_resource_type_resource_id_idx ON public.audit_log_y2026m05 USING btree (resource_type, resource_id);


--
-- Name: audit_log_y2026m06_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m06_actor_type_actor_id_idx ON public.audit_log_y2026m06 USING btree (actor_type, actor_id);


--
-- Name: audit_log_y2026m06_created_at_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m06_created_at_actor_type_actor_id_idx ON public.audit_log_y2026m06 USING btree (created_at DESC, actor_type, actor_id);


--
-- Name: audit_log_y2026m06_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m06_created_at_idx ON public.audit_log_y2026m06 USING btree (created_at DESC);


--
-- Name: audit_log_y2026m06_resource_type_resource_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m06_resource_type_resource_id_idx ON public.audit_log_y2026m06 USING btree (resource_type, resource_id);


--
-- Name: audit_log_y2026m07_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m07_actor_type_actor_id_idx ON public.audit_log_y2026m07 USING btree (actor_type, actor_id);


--
-- Name: audit_log_y2026m07_created_at_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m07_created_at_actor_type_actor_id_idx ON public.audit_log_y2026m07 USING btree (created_at DESC, actor_type, actor_id);


--
-- Name: audit_log_y2026m07_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m07_created_at_idx ON public.audit_log_y2026m07 USING btree (created_at DESC);


--
-- Name: audit_log_y2026m07_resource_type_resource_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m07_resource_type_resource_id_idx ON public.audit_log_y2026m07 USING btree (resource_type, resource_id);


--
-- Name: audit_log_y2026m08_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m08_actor_type_actor_id_idx ON public.audit_log_y2026m08 USING btree (actor_type, actor_id);


--
-- Name: audit_log_y2026m08_created_at_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m08_created_at_actor_type_actor_id_idx ON public.audit_log_y2026m08 USING btree (created_at DESC, actor_type, actor_id);


--
-- Name: audit_log_y2026m08_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m08_created_at_idx ON public.audit_log_y2026m08 USING btree (created_at DESC);


--
-- Name: audit_log_y2026m08_resource_type_resource_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m08_resource_type_resource_id_idx ON public.audit_log_y2026m08 USING btree (resource_type, resource_id);


--
-- Name: idx_ab_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ab_events_created_at ON public.ab_events USING btree (created_at DESC);


--
-- Name: idx_ab_events_experiment_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ab_events_experiment_variant ON public.ab_events USING btree (experiment_id, variant);


--
-- Name: idx_ab_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ab_events_user_id ON public.ab_events USING btree (user_id);


--
-- Name: idx_ab_experiments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ab_experiments_status ON public.ab_experiments USING btree (status);


--
-- Name: idx_abandoned_carts_email_sent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abandoned_carts_email_sent ON public.abandoned_carts USING btree (first_email_sent_at, second_email_sent_at) WHERE (recovered_at IS NULL);


--
-- Name: idx_abandoned_carts_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abandoned_carts_session_id ON public.abandoned_carts USING btree (session_id) WHERE (session_id IS NOT NULL);


--
-- Name: idx_abandoned_carts_unique_session; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_abandoned_carts_unique_session ON public.abandoned_carts USING btree (session_id) WHERE ((session_id IS NOT NULL) AND (user_id IS NULL));


--
-- Name: idx_abandoned_carts_unique_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_abandoned_carts_unique_user ON public.abandoned_carts USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_abandoned_carts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abandoned_carts_user_id ON public.abandoned_carts USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_admin_roles_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_roles_name ON public.admin_roles USING btree (name);


--
-- Name: idx_agent_daily_costs_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_daily_costs_lookup ON public.agent_daily_costs USING btree (agent_name, date);


--
-- Name: idx_ai_generations_parent_generation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_generations_parent_generation_id ON public.ai_generations USING btree (parent_generation_id);


--
-- Name: idx_ai_generations_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_generations_session_id ON public.ai_generations USING btree (session_id);


--
-- Name: idx_ai_generations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_generations_user ON public.ai_generations USING btree (user_id, created_at DESC);


--
-- Name: idx_analytics_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_created_at ON public.analytics_events USING btree (created_at DESC);


--
-- Name: idx_analytics_events_event_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_event_name ON public.analytics_events USING btree (event_name);


--
-- Name: idx_analytics_events_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_session_id ON public.analytics_events USING btree (session_id);


--
-- Name: idx_analytics_events_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_tenant_id ON public.analytics_events USING btree (tenant_id);


--
-- Name: idx_analytics_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_user_id ON public.analytics_events USING btree (user_id);


--
-- Name: idx_association_rules_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_association_rules_created_at ON public.association_rules USING btree (created_at DESC);


--
-- Name: idx_blog_posts_author_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_author_id ON public.blog_posts USING btree (author_id);


--
-- Name: idx_blog_posts_published_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_published_at ON public.blog_posts USING btree (published_at DESC) WHERE ((status)::text = 'published'::text);


--
-- Name: idx_blog_posts_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_slug ON public.blog_posts USING btree (slug);


--
-- Name: idx_blog_posts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_status ON public.blog_posts USING btree (status);


--
-- Name: idx_blog_posts_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_tags ON public.blog_posts USING gin (tags);


--
-- Name: idx_cart_items_composition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_items_composition ON public.cart_items USING btree (composition_id) WHERE (composition_id IS NOT NULL);


--
-- Name: idx_cart_items_personalization_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_items_personalization_id ON public.cart_items USING btree (personalization_id);


--
-- Name: idx_cart_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_items_product_id ON public.cart_items USING btree (product_id);


--
-- Name: idx_cart_items_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_items_session_id ON public.cart_items USING btree (session_id);


--
-- Name: idx_cart_items_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_items_tenant_id ON public.cart_items USING btree (tenant_id);


--
-- Name: idx_cart_items_unique_session_product_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_cart_items_unique_session_product_variant ON public.cart_items USING btree (session_id, product_id, variant_id) WHERE ((session_id IS NOT NULL) AND (user_id IS NULL));


--
-- Name: idx_cart_items_unique_user_product_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_cart_items_unique_user_product_variant ON public.cart_items USING btree (user_id, product_id, variant_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_cart_items_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_items_user_created ON public.cart_items USING btree (user_id, created_at DESC);


--
-- Name: idx_cart_items_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_items_user_id ON public.cart_items USING btree (user_id);


--
-- Name: idx_categories_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_is_active ON public.categories USING btree (is_active);


--
-- Name: idx_categories_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_parent_id ON public.categories USING btree (parent_id);


--
-- Name: idx_categories_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);


--
-- Name: idx_categories_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_tenant_id ON public.categories USING btree (tenant_id);


--
-- Name: idx_clipart_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clipart_category ON public.design_clipart USING btree (category) WHERE is_active;


--
-- Name: idx_collection_products_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collection_products_order ON public.collection_products USING btree (collection_id, "position");


--
-- Name: idx_collections_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collections_status ON public.collections USING btree (status);


--
-- Name: idx_conversations_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_session_id ON public.conversations USING btree (session_id);


--
-- Name: idx_conversations_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_tenant_id ON public.conversations USING btree (tenant_id);


--
-- Name: idx_conversations_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_user_created ON public.conversations USING btree (user_id, created_at DESC);


--
-- Name: idx_conversations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_user_id ON public.conversations USING btree (user_id);


--
-- Name: idx_coupon_uses_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupon_uses_user ON public.coupon_uses USING btree (user_id, coupon_id);


--
-- Name: idx_coupons_active_valid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_active_valid ON public.coupons USING btree (active, valid_from, valid_until);


--
-- Name: idx_coupons_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_code ON public.coupons USING btree (code);


--
-- Name: idx_credit_tx_unique_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_credit_tx_unique_payment ON public.credit_transactions USING btree (user_id, stripe_payment_id) WHERE (stripe_payment_id IS NOT NULL);


--
-- Name: idx_credit_tx_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_tx_user ON public.credit_transactions USING btree (user_id, created_at DESC);


--
-- Name: idx_cron_runs_name_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cron_runs_name_started ON public.cron_runs USING btree (cron_name, started_at DESC);


--
-- Name: idx_cron_runs_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cron_runs_started_at ON public.cron_runs USING btree (started_at DESC);


--
-- Name: idx_cron_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cron_runs_status ON public.cron_runs USING btree (status);


--
-- Name: idx_customer_segments_rfm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_segments_rfm ON public.customer_segments USING btree (rfm_score);


--
-- Name: idx_customer_segments_segment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_segments_segment ON public.customer_segments USING btree (segment);


--
-- Name: idx_demand_forecasts_product_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_demand_forecasts_product_date ON public.demand_forecasts USING btree (product_id, forecast_date);


--
-- Name: idx_design_compositions_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_compositions_product_id ON public.design_compositions USING btree (product_id);


--
-- Name: idx_design_compositions_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_compositions_session_id ON public.design_compositions USING btree (session_id);


--
-- Name: idx_design_compositions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_compositions_user ON public.design_compositions USING btree (user_id, created_at DESC);


--
-- Name: idx_design_sessions_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_sessions_product_id ON public.design_sessions USING btree (product_id);


--
-- Name: idx_design_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_design_sessions_user ON public.design_sessions USING btree (user_id, created_at DESC);


--
-- Name: idx_designs_gallery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designs_gallery ON public.designs USING btree (moderation_status, privacy_level, created_at DESC) WHERE (((moderation_status)::text = 'approved'::text) AND ((privacy_level)::text = 'public'::text));


--
-- Name: idx_designs_moderated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designs_moderated_by ON public.designs USING btree (moderated_by);


--
-- Name: idx_designs_parent_design_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designs_parent_design_id ON public.designs USING btree (parent_design_id);


--
-- Name: idx_designs_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designs_product_id ON public.designs USING btree (product_id);


--
-- Name: idx_designs_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designs_tenant_id ON public.designs USING btree (tenant_id);


--
-- Name: idx_designs_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designs_user_created ON public.designs USING btree (user_id, created_at DESC);


--
-- Name: idx_download_tokens_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_download_tokens_order ON public.download_tokens USING btree (order_id);


--
-- Name: idx_download_tokens_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_download_tokens_token ON public.download_tokens USING btree (token);


--
-- Name: idx_drip_queue_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drip_queue_pending ON public.drip_queue USING btree (status, send_at) WHERE ((status)::text = 'pending'::text);


--
-- Name: idx_drip_queue_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drip_queue_user ON public.drip_queue USING btree (user_id, sequence);


--
-- Name: idx_error_logs_error_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_error_hash ON public.error_logs USING btree (error_hash);


--
-- Name: idx_error_logs_first_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_first_seen ON public.error_logs USING btree (first_seen DESC);


--
-- Name: idx_error_logs_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_error_logs_last_seen ON public.error_logs USING btree (last_seen DESC);


--
-- Name: idx_heartbeat_events_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_heartbeat_events_fingerprint ON public.heartbeat_events USING btree (fingerprint, created_at DESC);


--
-- Name: idx_heartbeat_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_heartbeat_events_type ON public.heartbeat_events USING btree (event_type, created_at DESC);


--
-- Name: idx_hero_campaigns_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hero_campaigns_active ON public.hero_campaigns USING btree (priority DESC, starts_at) WHERE (status = 'active'::text);


--
-- Name: idx_marketing_content_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_content_platform ON public.marketing_content USING btree (platform);


--
-- Name: idx_marketing_content_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_content_product_id ON public.marketing_content USING btree (product_id);


--
-- Name: idx_marketing_content_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_content_status ON public.marketing_content USING btree (status);


--
-- Name: idx_message_feedback_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_feedback_rating ON public.message_feedback USING btree (rating, created_at DESC);


--
-- Name: idx_message_feedback_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_message_feedback_unique ON public.message_feedback USING btree (message_id, user_id);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON ONLY public.messages USING btree (conversation_id);


--
-- Name: idx_messages_conversation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation_created ON ONLY public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created ON ONLY public.messages USING btree (created_at DESC);


--
-- Name: idx_msg_conv_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_msg_conv_created ON public.messaging_conversations USING btree (created_at DESC);


--
-- Name: idx_msg_conv_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_msg_conv_link ON public.messaging_conversations USING btree (user_messaging_link_id);


--
-- Name: idx_newsletter_campaigns_segment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_campaigns_segment ON public.newsletter_campaigns USING btree (segment);


--
-- Name: idx_newsletter_subscribers_segment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_subscribers_segment ON public.newsletter_subscribers USING btree (rfm_segment);


--
-- Name: idx_newsletter_subscribers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_newsletter_subscribers_user_id ON public.newsletter_subscribers USING btree (user_id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_user_created_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_created_read ON public.notifications USING btree (user_id, created_at DESC, is_read);


--
-- Name: idx_notifications_user_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_read ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_order_items_composition; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_composition ON public.order_items USING btree (composition_id) WHERE (composition_id IS NOT NULL);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);


--
-- Name: idx_order_items_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_variant_id ON public.order_items USING btree (variant_id);


--
-- Name: idx_orders_external_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_external_order_id ON public.orders USING btree (external_order_id) WHERE (external_order_id IS NOT NULL);


--
-- Name: idx_orders_payment_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_payment_method ON public.orders USING btree (payment_method) WHERE (payment_method IS NOT NULL);


--
-- Name: idx_orders_pod_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_pod_retry ON public.orders USING btree (pod_retry_count, pod_last_attempt_at) WHERE ((pod_error IS NOT NULL) AND ((status)::text = 'paid'::text));


--
-- Name: idx_orders_printify_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_printify_status ON public.orders USING btree (printify_status);


--
-- Name: idx_orders_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status_created ON public.orders USING btree (status, created_at DESC);


--
-- Name: idx_orders_stripe_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_stripe_session ON public.orders USING btree (stripe_session_id);


--
-- Name: idx_orders_stripe_session_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_orders_stripe_session_unique ON public.orders USING btree (stripe_session_id) WHERE (stripe_session_id IS NOT NULL);


--
-- Name: idx_orders_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_tenant_id ON public.orders USING btree (tenant_id);


--
-- Name: idx_orders_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user_created ON public.orders USING btree (user_id, created_at DESC);


--
-- Name: idx_orders_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user_status ON public.orders USING btree (user_id, status);


--
-- Name: idx_pdm_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdm_date ON public.product_daily_metrics USING btree (metric_date DESC);


--
-- Name: idx_pdm_product_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pdm_product_date ON public.product_daily_metrics USING btree (product_id, metric_date DESC);


--
-- Name: idx_personalizations_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personalizations_product ON public.personalizations USING btree (product_id);


--
-- Name: idx_personalizations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personalizations_status ON public.personalizations USING btree (status);


--
-- Name: idx_personalizations_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personalizations_user ON public.personalizations USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_plc_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plc_product ON public.product_lifecycle_decisions USING btree (product_id, created_at DESC);


--
-- Name: idx_plc_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plc_status ON public.product_lifecycle_decisions USING btree (approval_status) WHERE (approval_status = 'pending'::text);


--
-- Name: idx_price_history_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_history_period ON public.price_history USING btree (period_start);


--
-- Name: idx_price_history_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_history_product ON public.price_history USING btree (product_id);


--
-- Name: idx_processed_events_processed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed_events_processed_at ON public.processed_events USING btree (processed_at);


--
-- Name: idx_processed_events_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed_events_provider ON public.processed_events USING btree (provider);


--
-- Name: idx_processed_events_provider_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_processed_events_provider_event_id ON public.processed_events USING btree (provider, event_id);


--
-- Name: idx_product_beliefs_lifecycle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_beliefs_lifecycle ON public.product_beliefs USING btree (lifecycle_status);


--
-- Name: idx_product_beliefs_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_beliefs_updated ON public.product_beliefs USING btree (updated_at DESC);


--
-- Name: idx_product_labels_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_labels_product_id ON public.product_labels USING btree (product_id);


--
-- Name: idx_product_labels_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_labels_type ON public.product_labels USING btree (label_type);


--
-- Name: idx_product_reviews_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_reviews_created_at ON public.product_reviews USING btree (created_at DESC);


--
-- Name: idx_product_reviews_moderated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_reviews_moderated_by ON public.product_reviews USING btree (moderated_by);


--
-- Name: idx_product_reviews_moderation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_reviews_moderation_status ON public.product_reviews USING btree (moderation_status);


--
-- Name: idx_product_reviews_product_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_reviews_product_created ON public.product_reviews USING btree (product_id, created_at DESC);


--
-- Name: idx_product_reviews_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_reviews_product_id ON public.product_reviews USING btree (product_id);


--
-- Name: idx_product_reviews_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_reviews_user_id ON public.product_reviews USING btree (user_id);


--
-- Name: idx_products_avg_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_avg_rating ON public.products USING btree (avg_rating DESC);


--
-- Name: idx_products_branded_hero; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_branded_hero ON public.products USING btree (branded_hero_url) WHERE (branded_hero_url IS NOT NULL);


--
-- Name: idx_products_category_id_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category_id_status ON public.products USING btree (category_id) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_products_category_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category_status ON public.products USING btree (category, status);


--
-- Name: idx_products_compare_at_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_compare_at_price ON public.products USING btree (compare_at_price_cents) WHERE (compare_at_price_cents IS NOT NULL);


--
-- Name: idx_products_cost; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_cost ON public.products USING btree (cost_cents) WHERE (cost_cents IS NOT NULL);


--
-- Name: idx_products_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_deleted_at ON public.products USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_products_deleted_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_deleted_by ON public.products USING btree (deleted_by);


--
-- Name: idx_products_pod_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_pod_provider ON public.products USING btree (pod_provider, status);


--
-- Name: idx_products_printify_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_printify_id ON public.products USING btree (printify_id);


--
-- Name: idx_products_product_details; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_product_details ON public.products USING gin (product_details);


--
-- Name: idx_products_provider_product_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_products_provider_product_unique ON public.products USING btree (pod_provider, provider_product_id) WHERE (provider_product_id IS NOT NULL);


--
-- Name: idx_products_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_tags ON public.products USING gin (tags);


--
-- Name: idx_products_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_tenant_id ON public.products USING btree (tenant_id);


--
-- Name: idx_products_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_type ON public.products USING btree (product_type) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_push_sub_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_sub_user ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_referrals_referrer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_referrer ON public.referrals USING btree (referrer_id);


--
-- Name: idx_return_requests_approved_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_requests_approved_by ON public.return_requests USING btree (approved_by);


--
-- Name: idx_return_requests_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_requests_order_id ON public.return_requests USING btree (order_id);


--
-- Name: idx_return_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_requests_status ON public.return_requests USING btree (status);


--
-- Name: idx_return_requests_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_return_requests_user_id ON public.return_requests USING btree (user_id);


--
-- Name: idx_returns_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_customer ON public.returns USING btree (customer_id, created_at DESC);


--
-- Name: idx_returns_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_order ON public.returns USING btree (order_id);


--
-- Name: idx_returns_resolved_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_resolved_by ON public.returns USING btree (resolved_by);


--
-- Name: idx_returns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_returns_status ON public.returns USING btree (status, created_at DESC);


--
-- Name: idx_seo_meta_tags_locale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seo_meta_tags_locale ON public.seo_meta_tags USING btree (locale);


--
-- Name: idx_shipping_addresses_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_addresses_user_id ON public.shipping_addresses USING btree (user_id);


--
-- Name: idx_shipping_zones_country_zip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shipping_zones_country_zip ON public.shipping_zones USING btree (country_code, zip_pattern);


--
-- Name: idx_soul_change_log_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_soul_change_log_status ON public.soul_change_log USING btree (status, created_at DESC);


--
-- Name: idx_system_events_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_events_pending ON public.system_events USING btree (status, created_at) WHERE (status = 'pending'::text);


--
-- Name: idx_system_events_urgent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_events_urgent ON public.system_events USING btree (wake_mode, status) WHERE ((wake_mode = 'now'::text) AND (status = 'pending'::text));


--
-- Name: idx_telegram_messages_chat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages USING btree (chat_id);


--
-- Name: idx_telegram_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_messages_created_at ON public.telegram_messages USING btree (created_at DESC);


--
-- Name: idx_telegram_messages_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_messages_user_id ON public.telegram_messages USING btree (user_id);


--
-- Name: idx_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_category ON public.design_templates_library USING btree (category) WHERE is_active;


--
-- Name: idx_tenant_members_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_members_tenant ON public.tenant_members USING btree (tenant_id);


--
-- Name: idx_tenant_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_members_user ON public.tenant_members USING btree (user_id);


--
-- Name: idx_tenants_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_owner_id ON public.tenants USING btree (owner_id);


--
-- Name: idx_tenants_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_slug ON public.tenants USING btree (slug);


--
-- Name: idx_tenants_stripe_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_stripe_customer ON public.tenants USING btree (stripe_customer_id);


--
-- Name: idx_tenants_stripe_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_stripe_subscription ON public.tenants USING btree (stripe_subscription_id);


--
-- Name: idx_translations_namespace_locale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_translations_namespace_locale ON public.translations USING btree (namespace, locale);


--
-- Name: idx_translations_reviewed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_translations_reviewed_by ON public.translations USING btree (reviewed_by);


--
-- Name: idx_trending_products_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_trending_products_id ON public.trending_products USING btree (id);


--
-- Name: idx_user_consents_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_consents_type ON public.user_consents USING btree (consent_type);


--
-- Name: idx_user_consents_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_consents_user_id ON public.user_consents USING btree (user_id);


--
-- Name: idx_user_consents_user_type_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_consents_user_type_timestamp ON public.user_consents USING btree (user_id, consent_type, "timestamp" DESC);


--
-- Name: idx_user_design_assets_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_design_assets_user ON public.user_design_assets USING btree (user_id, created_at DESC);


--
-- Name: idx_user_messaging_links_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_messaging_links_user_id ON public.user_messaging_links USING btree (user_id);


--
-- Name: idx_user_msg_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_msg_platform ON public.user_messaging_links USING btree (platform, platform_user_id);


--
-- Name: idx_user_roles_assigned_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_assigned_by ON public.user_roles USING btree (assigned_by);


--
-- Name: idx_user_roles_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_role_id ON public.user_roles USING btree (role_id);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: idx_user_usage_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_usage_lookup ON public.user_usage USING btree (identifier, action, period);


--
-- Name: idx_users_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_deleted_at ON public.users USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_users_deletion_requested; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_deletion_requested ON public.users USING btree (deletion_requested_at) WHERE ((deletion_requested_at IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: idx_users_must_change_password; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_must_change_password ON public.users USING btree (must_change_password) WHERE (must_change_password = true);


--
-- Name: idx_users_pending_hard_delete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_pending_hard_delete ON public.users USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_users_referral_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_referral_code ON public.users USING btree (referral_code);


--
-- Name: idx_users_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_tenant_id ON public.users USING btree (tenant_id);


--
-- Name: idx_variants_low_stock; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variants_low_stock ON public.product_variants USING btree (stock_quantity) WHERE ((track_inventory = true) AND (stock_quantity IS NOT NULL));


--
-- Name: idx_webhook_dlq_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_dlq_pending ON public.webhook_dead_letters USING btree (provider, created_at) WHERE (retried_at IS NULL);


--
-- Name: idx_whatsapp_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_messages_created_at ON public.whatsapp_messages USING btree (created_at DESC);


--
-- Name: idx_whatsapp_messages_from_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_whatsapp_messages_from_number ON public.whatsapp_messages USING btree (from_number);


--
-- Name: idx_wishlist_items_no_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_wishlist_items_no_variant ON public.wishlist_items USING btree (wishlist_id, product_id) WHERE (variant_id IS NULL);


--
-- Name: idx_wishlist_items_wishlist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_items_wishlist_id ON public.wishlist_items USING btree (wishlist_id);


--
-- Name: idx_wishlists_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlists_tenant_id ON public.wishlists USING btree (tenant_id);


--
-- Name: idx_wishlists_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlists_user_id ON public.wishlists USING btree (user_id);


--
-- Name: messages_y2026m02_conversation_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m02_conversation_id_created_at_idx ON public.messages_y2026m02 USING btree (conversation_id, created_at DESC);


--
-- Name: messages_y2026m02_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m02_conversation_id_idx ON public.messages_y2026m02 USING btree (conversation_id);


--
-- Name: messages_y2026m02_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m02_created_at_idx ON public.messages_y2026m02 USING btree (created_at DESC);


--
-- Name: messages_y2026m03_conversation_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m03_conversation_id_created_at_idx ON public.messages_y2026m03 USING btree (conversation_id, created_at DESC);


--
-- Name: messages_y2026m03_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m03_conversation_id_idx ON public.messages_y2026m03 USING btree (conversation_id);


--
-- Name: messages_y2026m03_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m03_created_at_idx ON public.messages_y2026m03 USING btree (created_at DESC);


--
-- Name: messages_y2026m04_conversation_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m04_conversation_id_created_at_idx ON public.messages_y2026m04 USING btree (conversation_id, created_at DESC);


--
-- Name: messages_y2026m04_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m04_conversation_id_idx ON public.messages_y2026m04 USING btree (conversation_id);


--
-- Name: messages_y2026m04_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m04_created_at_idx ON public.messages_y2026m04 USING btree (created_at DESC);


--
-- Name: messages_y2026m05_conversation_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m05_conversation_id_created_at_idx ON public.messages_y2026m05 USING btree (conversation_id, created_at DESC);


--
-- Name: messages_y2026m05_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m05_conversation_id_idx ON public.messages_y2026m05 USING btree (conversation_id);


--
-- Name: messages_y2026m05_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m05_created_at_idx ON public.messages_y2026m05 USING btree (created_at DESC);


--
-- Name: messages_y2026m06_conversation_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m06_conversation_id_created_at_idx ON public.messages_y2026m06 USING btree (conversation_id, created_at DESC);


--
-- Name: messages_y2026m06_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m06_conversation_id_idx ON public.messages_y2026m06 USING btree (conversation_id);


--
-- Name: messages_y2026m06_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m06_created_at_idx ON public.messages_y2026m06 USING btree (created_at DESC);


--
-- Name: messages_y2026m07_conversation_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m07_conversation_id_created_at_idx ON public.messages_y2026m07 USING btree (conversation_id, created_at DESC);


--
-- Name: messages_y2026m07_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m07_conversation_id_idx ON public.messages_y2026m07 USING btree (conversation_id);


--
-- Name: messages_y2026m07_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m07_created_at_idx ON public.messages_y2026m07 USING btree (created_at DESC);


--
-- Name: messages_y2026m08_conversation_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m08_conversation_id_created_at_idx ON public.messages_y2026m08 USING btree (conversation_id, created_at DESC);


--
-- Name: messages_y2026m08_conversation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m08_conversation_id_idx ON public.messages_y2026m08 USING btree (conversation_id);


--
-- Name: messages_y2026m08_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_y2026m08_created_at_idx ON public.messages_y2026m08 USING btree (created_at DESC);


--
-- Name: product_reviews_product_user_order_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_reviews_product_user_order_unique ON public.product_reviews USING btree (product_id, user_id, order_id) WHERE (order_id IS NOT NULL);


--
-- Name: product_reviews_product_user_unique_no_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_reviews_product_user_unique_no_order ON public.product_reviews USING btree (product_id, user_id) WHERE (order_id IS NULL);


--
-- Name: products_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_slug_unique ON public.products USING btree (slug);


--
-- Name: store_themes_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_themes_category_idx ON public.store_themes USING btree (category);


--
-- Name: store_themes_global_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX store_themes_global_active ON public.store_themes USING btree (is_active) WHERE ((is_active = true) AND (tenant_id IS NULL));


--
-- Name: store_themes_global_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX store_themes_global_default ON public.store_themes USING btree (is_default) WHERE ((is_default = true) AND (tenant_id IS NULL));


--
-- Name: store_themes_per_tenant_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX store_themes_per_tenant_active ON public.store_themes USING btree (tenant_id) WHERE ((is_active = true) AND (tenant_id IS NOT NULL));


--
-- Name: store_themes_per_tenant_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX store_themes_per_tenant_default ON public.store_themes USING btree (tenant_id) WHERE ((is_default = true) AND (tenant_id IS NOT NULL));


--
-- Name: store_themes_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX store_themes_slug_idx ON public.store_themes USING btree (slug);


--
-- Name: agent_events_y2026m02_agent_name_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_agent_created ATTACH PARTITION public.agent_events_y2026m02_agent_name_created_at_idx;


--
-- Name: agent_events_y2026m02_agent_name_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_agent_name ATTACH PARTITION public.agent_events_y2026m02_agent_name_idx;


--
-- Name: agent_events_y2026m02_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_created ATTACH PARTITION public.agent_events_y2026m02_created_at_idx;


--
-- Name: agent_events_y2026m02_event_type_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_type ATTACH PARTITION public.agent_events_y2026m02_event_type_idx;


--
-- Name: agent_events_y2026m02_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.agent_events_new_pkey ATTACH PARTITION public.agent_events_y2026m02_pkey;


--
-- Name: agent_events_y2026m02_session_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_session ATTACH PARTITION public.agent_events_y2026m02_session_id_idx;


--
-- Name: agent_events_y2026m03_agent_name_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_agent_created ATTACH PARTITION public.agent_events_y2026m03_agent_name_created_at_idx;


--
-- Name: agent_events_y2026m03_agent_name_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_agent_name ATTACH PARTITION public.agent_events_y2026m03_agent_name_idx;


--
-- Name: agent_events_y2026m03_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_created ATTACH PARTITION public.agent_events_y2026m03_created_at_idx;


--
-- Name: agent_events_y2026m03_event_type_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_type ATTACH PARTITION public.agent_events_y2026m03_event_type_idx;


--
-- Name: agent_events_y2026m03_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.agent_events_new_pkey ATTACH PARTITION public.agent_events_y2026m03_pkey;


--
-- Name: agent_events_y2026m03_session_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_session ATTACH PARTITION public.agent_events_y2026m03_session_id_idx;


--
-- Name: agent_events_y2026m04_agent_name_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_agent_created ATTACH PARTITION public.agent_events_y2026m04_agent_name_created_at_idx;


--
-- Name: agent_events_y2026m04_agent_name_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_agent_name ATTACH PARTITION public.agent_events_y2026m04_agent_name_idx;


--
-- Name: agent_events_y2026m04_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_created ATTACH PARTITION public.agent_events_y2026m04_created_at_idx;


--
-- Name: agent_events_y2026m04_event_type_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_type ATTACH PARTITION public.agent_events_y2026m04_event_type_idx;


--
-- Name: agent_events_y2026m04_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.agent_events_new_pkey ATTACH PARTITION public.agent_events_y2026m04_pkey;


--
-- Name: agent_events_y2026m04_session_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_session ATTACH PARTITION public.agent_events_y2026m04_session_id_idx;


--
-- Name: agent_events_y2026m05_agent_name_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_agent_created ATTACH PARTITION public.agent_events_y2026m05_agent_name_created_at_idx;


--
-- Name: agent_events_y2026m05_agent_name_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_agent_name ATTACH PARTITION public.agent_events_y2026m05_agent_name_idx;


--
-- Name: agent_events_y2026m05_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_created ATTACH PARTITION public.agent_events_y2026m05_created_at_idx;


--
-- Name: agent_events_y2026m05_event_type_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_type ATTACH PARTITION public.agent_events_y2026m05_event_type_idx;


--
-- Name: agent_events_y2026m05_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.agent_events_new_pkey ATTACH PARTITION public.agent_events_y2026m05_pkey;


--
-- Name: agent_events_y2026m05_session_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_session ATTACH PARTITION public.agent_events_y2026m05_session_id_idx;


--
-- Name: agent_events_y2026m06_agent_name_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_agent_created ATTACH PARTITION public.agent_events_y2026m06_agent_name_created_at_idx;


--
-- Name: agent_events_y2026m06_agent_name_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_agent_name ATTACH PARTITION public.agent_events_y2026m06_agent_name_idx;


--
-- Name: agent_events_y2026m06_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_created ATTACH PARTITION public.agent_events_y2026m06_created_at_idx;


--
-- Name: agent_events_y2026m06_event_type_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_type ATTACH PARTITION public.agent_events_y2026m06_event_type_idx;


--
-- Name: agent_events_y2026m06_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.agent_events_new_pkey ATTACH PARTITION public.agent_events_y2026m06_pkey;


--
-- Name: agent_events_y2026m06_session_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_session ATTACH PARTITION public.agent_events_y2026m06_session_id_idx;


--
-- Name: agent_events_y2026m07_agent_name_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_agent_created ATTACH PARTITION public.agent_events_y2026m07_agent_name_created_at_idx;


--
-- Name: agent_events_y2026m07_agent_name_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_agent_name ATTACH PARTITION public.agent_events_y2026m07_agent_name_idx;


--
-- Name: agent_events_y2026m07_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_created ATTACH PARTITION public.agent_events_y2026m07_created_at_idx;


--
-- Name: agent_events_y2026m07_event_type_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_type ATTACH PARTITION public.agent_events_y2026m07_event_type_idx;


--
-- Name: agent_events_y2026m07_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.agent_events_new_pkey ATTACH PARTITION public.agent_events_y2026m07_pkey;


--
-- Name: agent_events_y2026m07_session_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_session ATTACH PARTITION public.agent_events_y2026m07_session_id_idx;


--
-- Name: agent_events_y2026m08_agent_name_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_agent_created ATTACH PARTITION public.agent_events_y2026m08_agent_name_created_at_idx;


--
-- Name: agent_events_y2026m08_agent_name_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_agent_name ATTACH PARTITION public.agent_events_y2026m08_agent_name_idx;


--
-- Name: agent_events_y2026m08_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_created ATTACH PARTITION public.agent_events_y2026m08_created_at_idx;


--
-- Name: agent_events_y2026m08_event_type_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_type ATTACH PARTITION public.agent_events_y2026m08_event_type_idx;


--
-- Name: agent_events_y2026m08_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.agent_events_new_pkey ATTACH PARTITION public.agent_events_y2026m08_pkey;


--
-- Name: agent_events_y2026m08_session_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_agent_events_session ATTACH PARTITION public.agent_events_y2026m08_session_id_idx;


--
-- Name: audit_log_y2026m02_actor_type_actor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor ATTACH PARTITION public.audit_log_y2026m02_actor_type_actor_id_idx;


--
-- Name: audit_log_y2026m02_created_at_actor_type_actor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_created_actor ATTACH PARTITION public.audit_log_y2026m02_created_at_actor_type_actor_id_idx;


--
-- Name: audit_log_y2026m02_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_created ATTACH PARTITION public.audit_log_y2026m02_created_at_idx;


--
-- Name: audit_log_y2026m02_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_new_pkey ATTACH PARTITION public.audit_log_y2026m02_pkey;


--
-- Name: audit_log_y2026m02_resource_type_resource_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_resource ATTACH PARTITION public.audit_log_y2026m02_resource_type_resource_id_idx;


--
-- Name: audit_log_y2026m03_actor_type_actor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor ATTACH PARTITION public.audit_log_y2026m03_actor_type_actor_id_idx;


--
-- Name: audit_log_y2026m03_created_at_actor_type_actor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_created_actor ATTACH PARTITION public.audit_log_y2026m03_created_at_actor_type_actor_id_idx;


--
-- Name: audit_log_y2026m03_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_created ATTACH PARTITION public.audit_log_y2026m03_created_at_idx;


--
-- Name: audit_log_y2026m03_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_new_pkey ATTACH PARTITION public.audit_log_y2026m03_pkey;


--
-- Name: audit_log_y2026m03_resource_type_resource_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_resource ATTACH PARTITION public.audit_log_y2026m03_resource_type_resource_id_idx;


--
-- Name: audit_log_y2026m04_actor_type_actor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor ATTACH PARTITION public.audit_log_y2026m04_actor_type_actor_id_idx;


--
-- Name: audit_log_y2026m04_created_at_actor_type_actor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_created_actor ATTACH PARTITION public.audit_log_y2026m04_created_at_actor_type_actor_id_idx;


--
-- Name: audit_log_y2026m04_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_created ATTACH PARTITION public.audit_log_y2026m04_created_at_idx;


--
-- Name: audit_log_y2026m04_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_new_pkey ATTACH PARTITION public.audit_log_y2026m04_pkey;


--
-- Name: audit_log_y2026m04_resource_type_resource_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_resource ATTACH PARTITION public.audit_log_y2026m04_resource_type_resource_id_idx;


--
-- Name: audit_log_y2026m05_actor_type_actor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor ATTACH PARTITION public.audit_log_y2026m05_actor_type_actor_id_idx;


--
-- Name: audit_log_y2026m05_created_at_actor_type_actor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_created_actor ATTACH PARTITION public.audit_log_y2026m05_created_at_actor_type_actor_id_idx;


--
-- Name: audit_log_y2026m05_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_created ATTACH PARTITION public.audit_log_y2026m05_created_at_idx;


--
-- Name: audit_log_y2026m05_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_new_pkey ATTACH PARTITION public.audit_log_y2026m05_pkey;


--
-- Name: audit_log_y2026m05_resource_type_resource_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_resource ATTACH PARTITION public.audit_log_y2026m05_resource_type_resource_id_idx;


--
-- Name: audit_log_y2026m06_actor_type_actor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor ATTACH PARTITION public.audit_log_y2026m06_actor_type_actor_id_idx;


--
-- Name: audit_log_y2026m06_created_at_actor_type_actor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_created_actor ATTACH PARTITION public.audit_log_y2026m06_created_at_actor_type_actor_id_idx;


--
-- Name: audit_log_y2026m06_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_created ATTACH PARTITION public.audit_log_y2026m06_created_at_idx;


--
-- Name: audit_log_y2026m06_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_new_pkey ATTACH PARTITION public.audit_log_y2026m06_pkey;


--
-- Name: audit_log_y2026m06_resource_type_resource_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_resource ATTACH PARTITION public.audit_log_y2026m06_resource_type_resource_id_idx;


--
-- Name: audit_log_y2026m07_actor_type_actor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor ATTACH PARTITION public.audit_log_y2026m07_actor_type_actor_id_idx;


--
-- Name: audit_log_y2026m07_created_at_actor_type_actor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_created_actor ATTACH PARTITION public.audit_log_y2026m07_created_at_actor_type_actor_id_idx;


--
-- Name: audit_log_y2026m07_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_created ATTACH PARTITION public.audit_log_y2026m07_created_at_idx;


--
-- Name: audit_log_y2026m07_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_new_pkey ATTACH PARTITION public.audit_log_y2026m07_pkey;


--
-- Name: audit_log_y2026m07_resource_type_resource_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_resource ATTACH PARTITION public.audit_log_y2026m07_resource_type_resource_id_idx;


--
-- Name: audit_log_y2026m08_actor_type_actor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor ATTACH PARTITION public.audit_log_y2026m08_actor_type_actor_id_idx;


--
-- Name: audit_log_y2026m08_created_at_actor_type_actor_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_created_actor ATTACH PARTITION public.audit_log_y2026m08_created_at_actor_type_actor_id_idx;


--
-- Name: audit_log_y2026m08_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_created ATTACH PARTITION public.audit_log_y2026m08_created_at_idx;


--
-- Name: audit_log_y2026m08_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_new_pkey ATTACH PARTITION public.audit_log_y2026m08_pkey;


--
-- Name: audit_log_y2026m08_resource_type_resource_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_resource ATTACH PARTITION public.audit_log_y2026m08_resource_type_resource_id_idx;


--
-- Name: messages_y2026m02_conversation_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_conversation_created ATTACH PARTITION public.messages_y2026m02_conversation_id_created_at_idx;


--
-- Name: messages_y2026m02_conversation_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_conversation ATTACH PARTITION public.messages_y2026m02_conversation_id_idx;


--
-- Name: messages_y2026m02_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_created ATTACH PARTITION public.messages_y2026m02_created_at_idx;


--
-- Name: messages_y2026m02_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.messages_new_pkey ATTACH PARTITION public.messages_y2026m02_pkey;


--
-- Name: messages_y2026m03_conversation_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_conversation_created ATTACH PARTITION public.messages_y2026m03_conversation_id_created_at_idx;


--
-- Name: messages_y2026m03_conversation_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_conversation ATTACH PARTITION public.messages_y2026m03_conversation_id_idx;


--
-- Name: messages_y2026m03_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_created ATTACH PARTITION public.messages_y2026m03_created_at_idx;


--
-- Name: messages_y2026m03_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.messages_new_pkey ATTACH PARTITION public.messages_y2026m03_pkey;


--
-- Name: messages_y2026m04_conversation_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_conversation_created ATTACH PARTITION public.messages_y2026m04_conversation_id_created_at_idx;


--
-- Name: messages_y2026m04_conversation_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_conversation ATTACH PARTITION public.messages_y2026m04_conversation_id_idx;


--
-- Name: messages_y2026m04_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_created ATTACH PARTITION public.messages_y2026m04_created_at_idx;


--
-- Name: messages_y2026m04_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.messages_new_pkey ATTACH PARTITION public.messages_y2026m04_pkey;


--
-- Name: messages_y2026m05_conversation_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_conversation_created ATTACH PARTITION public.messages_y2026m05_conversation_id_created_at_idx;


--
-- Name: messages_y2026m05_conversation_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_conversation ATTACH PARTITION public.messages_y2026m05_conversation_id_idx;


--
-- Name: messages_y2026m05_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_created ATTACH PARTITION public.messages_y2026m05_created_at_idx;


--
-- Name: messages_y2026m05_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.messages_new_pkey ATTACH PARTITION public.messages_y2026m05_pkey;


--
-- Name: messages_y2026m06_conversation_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_conversation_created ATTACH PARTITION public.messages_y2026m06_conversation_id_created_at_idx;


--
-- Name: messages_y2026m06_conversation_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_conversation ATTACH PARTITION public.messages_y2026m06_conversation_id_idx;


--
-- Name: messages_y2026m06_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_created ATTACH PARTITION public.messages_y2026m06_created_at_idx;


--
-- Name: messages_y2026m06_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.messages_new_pkey ATTACH PARTITION public.messages_y2026m06_pkey;


--
-- Name: messages_y2026m07_conversation_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_conversation_created ATTACH PARTITION public.messages_y2026m07_conversation_id_created_at_idx;


--
-- Name: messages_y2026m07_conversation_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_conversation ATTACH PARTITION public.messages_y2026m07_conversation_id_idx;


--
-- Name: messages_y2026m07_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_created ATTACH PARTITION public.messages_y2026m07_created_at_idx;


--
-- Name: messages_y2026m07_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.messages_new_pkey ATTACH PARTITION public.messages_y2026m07_pkey;


--
-- Name: messages_y2026m08_conversation_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_conversation_created ATTACH PARTITION public.messages_y2026m08_conversation_id_created_at_idx;


--
-- Name: messages_y2026m08_conversation_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_conversation ATTACH PARTITION public.messages_y2026m08_conversation_id_idx;


--
-- Name: messages_y2026m08_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_messages_created ATTACH PARTITION public.messages_y2026m08_created_at_idx;


--
-- Name: messages_y2026m08_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.messages_new_pkey ATTACH PARTITION public.messages_y2026m08_pkey;


--
-- Name: abandoned_carts abandoned_carts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER abandoned_carts_updated_at BEFORE UPDATE ON public.abandoned_carts FOR EACH ROW EXECUTE FUNCTION public.update_abandoned_carts_updated_at();


--
-- Name: product_reviews after_review_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER after_review_change AFTER INSERT OR DELETE OR UPDATE ON public.product_reviews FOR EACH ROW EXECUTE FUNCTION public.trigger_update_product_rating();


--
-- Name: blog_posts blog_posts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_blog_posts_updated_at();


--
-- Name: cart_items cart_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cart_items_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.update_cart_items_updated_at();


--
-- Name: cron_runs cron_runs_calculate_duration; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cron_runs_calculate_duration BEFORE UPDATE ON public.cron_runs FOR EACH ROW EXECUTE FUNCTION public.calculate_cron_duration();


--
-- Name: legal_pages legal_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER legal_pages_updated_at BEFORE UPDATE ON public.legal_pages FOR EACH ROW EXECUTE FUNCTION public.update_legal_pages_updated_at();


--
-- Name: legal_settings legal_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER legal_settings_updated_at BEFORE UPDATE ON public.legal_settings FOR EACH ROW EXECUTE FUNCTION public.update_legal_settings_updated_at();


--
-- Name: return_requests return_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER return_requests_updated_at BEFORE UPDATE ON public.return_requests FOR EACH ROW EXECUTE FUNCTION public.update_return_requests_updated_at();


--
-- Name: returns returns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER returns_updated_at BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.update_returns_updated_at();


--
-- Name: store_themes store_themes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER store_themes_updated_at BEFORE UPDATE ON public.store_themes FOR EACH ROW EXECUTE FUNCTION public.update_store_themes_updated_at();


--
-- Name: tenants tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_tenant_updated_at();


--
-- Name: admin_roles trg_admin_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_admin_roles_updated_at BEFORE UPDATE ON public.admin_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: admin_settings trg_admin_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_admin_settings_updated_at BEFORE UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: agent_daily_costs trg_agent_daily_costs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_agent_daily_costs_updated_at BEFORE UPDATE ON public.agent_daily_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: brand_config trg_brand_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_brand_config_updated_at BEFORE UPDATE ON public.brand_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: categories trg_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: coupons trg_coupons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customer_segments trg_customer_segments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customer_segments_updated_at BEFORE UPDATE ON public.customer_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: design_compositions trg_design_compositions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_design_compositions_updated_at BEFORE UPDATE ON public.design_compositions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: design_sessions trg_design_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_design_sessions_updated_at BEFORE UPDATE ON public.design_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: messaging_channels trg_messaging_channels_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_messaging_channels_updated_at BEFORE UPDATE ON public.messaging_channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: personalizations trg_personalizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_personalizations_updated_at BEFORE UPDATE ON public.personalizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_beliefs trg_product_beliefs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_beliefs_updated_at BEFORE UPDATE ON public.product_beliefs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products trg_product_create_belief; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_product_create_belief AFTER INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.create_product_belief();


--
-- Name: seo_meta_tags trg_seo_meta_tags_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_seo_meta_tags_updated_at BEFORE UPDATE ON public.seo_meta_tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: shipping_zones trg_shipping_zones_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shipping_zones_updated_at BEFORE UPDATE ON public.shipping_zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tenant_configs trg_tenant_configs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tenant_configs_updated_at BEFORE UPDATE ON public.tenant_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: translations trg_translations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_translations_updated_at BEFORE UPDATE ON public.translations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_usage trg_user_usage_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_usage_updated_at BEFORE UPDATE ON public.user_usage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cart_items update_cart_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: conversations update_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: error_logs update_error_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_error_logs_updated_at BEFORE UPDATE ON public.error_logs FOR EACH ROW EXECUTE FUNCTION public.update_error_logs_updated_at();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ab_events ab_events_experiment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ab_events
    ADD CONSTRAINT ab_events_experiment_id_fkey FOREIGN KEY (experiment_id) REFERENCES public.ab_experiments(id) ON DELETE CASCADE;


--
-- Name: ab_events ab_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ab_events
    ADD CONSTRAINT ab_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: abandoned_carts abandoned_carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abandoned_carts
    ADD CONSTRAINT abandoned_carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: agent_events agent_events_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.agent_events
    ADD CONSTRAINT agent_events_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.agent_sessions(id) ON DELETE CASCADE;


--
-- Name: ai_generations ai_generations_parent_generation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generations
    ADD CONSTRAINT ai_generations_parent_generation_id_fkey FOREIGN KEY (parent_generation_id) REFERENCES public.ai_generations(id) ON DELETE SET NULL;


--
-- Name: ai_generations ai_generations_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generations
    ADD CONSTRAINT ai_generations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.design_sessions(id) ON DELETE CASCADE;


--
-- Name: ai_generations ai_generations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generations
    ADD CONSTRAINT ai_generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: analytics_events analytics_events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: analytics_events analytics_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: blog_posts blog_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cart_items cart_items_composition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_composition_id_fkey FOREIGN KEY (composition_id) REFERENCES public.design_compositions(id);


--
-- Name: cart_items cart_items_personalization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_personalization_id_fkey FOREIGN KEY (personalization_id) REFERENCES public.personalizations(id);


--
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: categories categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: collection_products collection_products_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_products
    ADD CONSTRAINT collection_products_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE CASCADE;


--
-- Name: collection_products collection_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_products
    ADD CONSTRAINT collection_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: coupon_uses coupon_uses_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_uses
    ADD CONSTRAINT coupon_uses_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id);


--
-- Name: coupon_uses coupon_uses_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_uses
    ADD CONSTRAINT coupon_uses_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: credit_transactions credit_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: customer_segments customer_segments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_segments
    ADD CONSTRAINT customer_segments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: demand_forecasts demand_forecasts_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.demand_forecasts
    ADD CONSTRAINT demand_forecasts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: design_compositions design_compositions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_compositions
    ADD CONSTRAINT design_compositions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: design_compositions design_compositions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_compositions
    ADD CONSTRAINT design_compositions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.design_sessions(id) ON DELETE SET NULL;


--
-- Name: design_compositions design_compositions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_compositions
    ADD CONSTRAINT design_compositions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: design_sessions design_sessions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_sessions
    ADD CONSTRAINT design_sessions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: design_sessions design_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.design_sessions
    ADD CONSTRAINT design_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: designs designs_moderated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designs
    ADD CONSTRAINT designs_moderated_by_fkey FOREIGN KEY (moderated_by) REFERENCES public.users(id);


--
-- Name: designs designs_parent_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designs
    ADD CONSTRAINT designs_parent_design_id_fkey FOREIGN KEY (parent_design_id) REFERENCES public.designs(id) ON DELETE SET NULL;


--
-- Name: designs designs_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designs
    ADD CONSTRAINT designs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: designs designs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designs
    ADD CONSTRAINT designs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: designs designs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designs
    ADD CONSTRAINT designs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: drip_queue drip_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drip_queue
    ADD CONSTRAINT drip_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: hero_campaigns hero_campaigns_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hero_campaigns
    ADD CONSTRAINT hero_campaigns_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.collections(id) ON DELETE SET NULL;


--
-- Name: legal_page_versions legal_page_versions_legal_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legal_page_versions
    ADD CONSTRAINT legal_page_versions_legal_page_id_fkey FOREIGN KEY (legal_page_id) REFERENCES public.legal_pages(id) ON DELETE CASCADE;


--
-- Name: marketing_content marketing_content_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_content
    ADD CONSTRAINT marketing_content_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: message_feedback message_feedback_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT message_feedback_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: message_feedback message_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_feedback
    ADD CONSTRAINT message_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messaging_conversations messaging_conversations_user_messaging_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_conversations
    ADD CONSTRAINT messaging_conversations_user_messaging_link_id_fkey FOREIGN KEY (user_messaging_link_id) REFERENCES public.user_messaging_links(id) ON DELETE CASCADE;


--
-- Name: newsletter_subscribers newsletter_subscribers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_composition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_composition_id_fkey FOREIGN KEY (composition_id) REFERENCES public.design_compositions(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: order_items order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE RESTRICT;


--
-- Name: orders orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: personalizations personalizations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.personalizations
    ADD CONSTRAINT personalizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: price_history price_history_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_beliefs product_beliefs_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_beliefs
    ADD CONSTRAINT product_beliefs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_daily_metrics product_daily_metrics_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_daily_metrics
    ADD CONSTRAINT product_daily_metrics_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_labels product_labels_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_labels
    ADD CONSTRAINT product_labels_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_lifecycle_decisions product_lifecycle_decisions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_lifecycle_decisions
    ADD CONSTRAINT product_lifecycle_decisions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_moderated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_moderated_by_fkey FOREIGN KEY (moderated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: product_reviews product_reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: products products_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: products products_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: referrals referrals_referred_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: return_requests return_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: return_requests return_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: return_requests return_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: returns returns_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: returns returns_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: returns returns_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: shipping_addresses shipping_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_addresses
    ADD CONSTRAINT shipping_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: store_themes store_themes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_themes
    ADD CONSTRAINT store_themes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_configs tenant_configs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_configs
    ADD CONSTRAINT tenant_configs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_members tenant_members_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_members
    ADD CONSTRAINT tenant_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_members tenant_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_members
    ADD CONSTRAINT tenant_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: translations translations_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.translations
    ADD CONSTRAINT translations_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_consents user_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_consents
    ADD CONSTRAINT user_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_design_assets user_design_assets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_design_assets
    ADD CONSTRAINT user_design_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_messaging_links user_messaging_links_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_messaging_links
    ADD CONSTRAINT user_messaging_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.admin_roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: wishlist_items wishlist_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: wishlist_items wishlist_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: wishlist_items wishlist_items_wishlist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_wishlist_id_fkey FOREIGN KEY (wishlist_id) REFERENCES public.wishlists(id) ON DELETE CASCADE;


--
-- Name: wishlists wishlists_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: wishlists wishlists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ab_experiments Admin can manage experiments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage experiments" ON public.ab_experiments USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text)))));


--
-- Name: ab_events Admin can read events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can read events" ON public.ab_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text)))));


--
-- Name: legal_page_versions Admins can create legal page versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create legal page versions" ON public.legal_page_versions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text)))));


--
-- Name: legal_pages Admins can manage legal pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage legal pages" ON public.legal_pages USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text)))));


--
-- Name: seo_meta_tags Admins can update SEO meta tags; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update SEO meta tags" ON public.seo_meta_tags FOR UPDATE USING (false);


--
-- Name: legal_settings Admins can update legal settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update legal settings" ON public.legal_settings FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text)))));


--
-- Name: return_requests Admins can update return requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update return requests" ON public.return_requests FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text)))));


--
-- Name: returns Admins can update returns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update returns" ON public.returns FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = ANY (ARRAY[('admin'::character varying)::text, ('staff'::character varying)::text]))))));


--
-- Name: return_requests Admins can view all return requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all return requests" ON public.return_requests FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text)))));


--
-- Name: returns Admins can view all returns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all returns" ON public.returns FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = ANY (ARRAY[('admin'::character varying)::text, ('staff'::character varying)::text]))))));


--
-- Name: analytics_events Anyone can insert analytics events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert analytics events" ON public.analytics_events FOR INSERT WITH CHECK (true);


--
-- Name: ab_events Anyone can insert events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert events" ON public.ab_events FOR INSERT WITH CHECK (true);


--
-- Name: coupons Anyone can read active coupons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read active coupons" ON public.coupons FOR SELECT USING ((active = true));


--
-- Name: blog_posts Anyone can view published blog posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view published blog posts" ON public.blog_posts FOR SELECT USING (((status)::text = 'published'::text));


--
-- Name: store_themes Authenticated users can delete custom themes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can delete custom themes" ON public.store_themes FOR DELETE TO authenticated USING ((is_custom = true));


--
-- Name: store_themes Authenticated users can insert themes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can insert themes" ON public.store_themes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: returns Customers can create their own returns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can create their own returns" ON public.returns FOR INSERT WITH CHECK (((auth.uid() = customer_id) AND (EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = returns.order_id) AND (orders.user_id = returns.customer_id))))));


--
-- Name: returns Customers can view their own returns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their own returns" ON public.returns FOR SELECT USING ((auth.uid() = customer_id));


--
-- Name: legal_pages Public can read active legal pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read active legal pages" ON public.legal_pages FOR SELECT USING ((is_active = true));


--
-- Name: tenant_configs Public can read branding and legal configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read branding and legal configs" ON public.tenant_configs FOR SELECT TO authenticated, anon USING (((key ~~ 'branding:%'::text) OR (key ~~ 'legal:%'::text)));


--
-- Name: legal_page_versions Public can read legal page versions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read legal page versions" ON public.legal_page_versions FOR SELECT USING (true);


--
-- Name: legal_settings Public can read legal settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read legal settings" ON public.legal_settings FOR SELECT USING (true);


--
-- Name: categories Public can view active categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active categories" ON public.categories FOR SELECT USING ((is_active = true));


--
-- Name: brand_config Public read active config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read active config" ON public.brand_config FOR SELECT USING ((is_active = true));


--
-- Name: product_labels Public read labels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read labels" ON public.product_labels FOR SELECT USING (true);


--
-- Name: seo_meta_tags SEO meta tags are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "SEO meta tags are publicly readable" ON public.seo_meta_tags FOR SELECT USING (true);


--
-- Name: user_consents Service role can insert consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert consents" ON public.user_consents FOR INSERT WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: user_consents Service role can view all consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can view all consents" ON public.user_consents FOR SELECT USING ((auth.role() = 'service_role'::text));


--
-- Name: brand_config Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.brand_config USING ((auth.role() = 'service_role'::text));


--
-- Name: personalizations Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.personalizations USING ((auth.role() = 'service_role'::text));


--
-- Name: product_labels Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.product_labels USING ((auth.role() = 'service_role'::text));


--
-- Name: daily_portfolio_metrics Service role full access on daily_portfolio_metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access on daily_portfolio_metrics" ON public.daily_portfolio_metrics USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: product_beliefs Service role full access on product_beliefs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access on product_beliefs" ON public.product_beliefs USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: product_daily_metrics Service role full access on product_daily_metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access on product_daily_metrics" ON public.product_daily_metrics USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: product_lifecycle_decisions Service role full access on product_lifecycle_decisions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access on product_lifecycle_decisions" ON public.product_lifecycle_decisions USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: agent_daily_costs Service role full access to agent_daily_costs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to agent_daily_costs" ON public.agent_daily_costs USING ((auth.role() = 'service_role'::text));


--
-- Name: agent_events Service role full access to agent_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to agent_events" ON public.agent_events USING ((auth.role() = 'service_role'::text));


--
-- Name: agent_sessions Service role full access to agent_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to agent_sessions" ON public.agent_sessions USING ((auth.role() = 'service_role'::text));


--
-- Name: messaging_channels Service role full access to messaging_channels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to messaging_channels" ON public.messaging_channels USING ((auth.role() = 'service_role'::text));


--
-- Name: messaging_conversations Service role full access to messaging_conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to messaging_conversations" ON public.messaging_conversations USING ((auth.role() = 'service_role'::text));


--
-- Name: telegram_messages Service role full access to telegram_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to telegram_messages" ON public.telegram_messages USING ((auth.role() = 'service_role'::text));


--
-- Name: user_messaging_links Service role full access to user_messaging_links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to user_messaging_links" ON public.user_messaging_links USING ((auth.role() = 'service_role'::text));


--
-- Name: whatsapp_messages Service role full access to whatsapp_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to whatsapp_messages" ON public.whatsapp_messages USING ((auth.role() = 'service_role'::text));


--
-- Name: ai_generations Service role has full access to ai generations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role has full access to ai generations" ON public.ai_generations TO service_role USING (true) WITH CHECK (true);


--
-- Name: user_design_assets Service role has full access to design assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role has full access to design assets" ON public.user_design_assets TO service_role USING (true) WITH CHECK (true);


--
-- Name: design_compositions Service role has full access to design compositions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role has full access to design compositions" ON public.design_compositions TO service_role USING (true) WITH CHECK (true);


--
-- Name: design_sessions Service role has full access to design sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role has full access to design sessions" ON public.design_sessions TO service_role USING (true) WITH CHECK (true);


--
-- Name: user_usage Service role manages user_usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages user_usage" ON public.user_usage USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: store_themes Themes are publicly readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Themes are publicly readable" ON public.store_themes FOR SELECT USING (true);


--
-- Name: cart_items Users can delete their own cart items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own cart items" ON public.cart_items FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_consents Users can insert own consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own consents" ON public.user_consents FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: cart_items Users can insert their own cart items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own cart items" ON public.cart_items FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: shipping_addresses Users can manage own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own addresses" ON public.shipping_addresses USING ((auth.uid() = user_id));


--
-- Name: ai_generations Users can manage own ai generations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own ai generations" ON public.ai_generations USING ((auth.uid() = user_id));


--
-- Name: cart_items Users can manage own cart; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own cart" ON public.cart_items USING ((auth.uid() = user_id));


--
-- Name: user_design_assets Users can manage own design assets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own design assets" ON public.user_design_assets USING ((auth.uid() = user_id));


--
-- Name: design_compositions Users can manage own design compositions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own design compositions" ON public.design_compositions USING ((auth.uid() = user_id));


--
-- Name: design_sessions Users can manage own design sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own design sessions" ON public.design_sessions USING ((auth.uid() = user_id));


--
-- Name: wishlist_items Users can manage own wishlist items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own wishlist items" ON public.wishlist_items USING ((EXISTS ( SELECT 1
   FROM public.wishlists
  WHERE ((wishlists.id = wishlist_items.wishlist_id) AND (wishlists.user_id = auth.uid())))));


--
-- Name: wishlists Users can manage own wishlists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own wishlists" ON public.wishlists USING ((auth.uid() = user_id));


--
-- Name: notifications Users can mark own notifications as read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can mark own notifications as read" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: coupon_uses Users can read own coupon uses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own coupon uses" ON public.coupon_uses FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: personalizations Users can update own personalizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own personalizations" ON public.personalizations FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: users Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING ((auth.uid() = id)) WITH CHECK (((auth.uid() = id) AND ((role)::text = (( SELECT users_1.role
   FROM public.users users_1
  WHERE (users_1.id = auth.uid())))::text)));


--
-- Name: product_reviews Users can update own reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own reviews" ON public.product_reviews FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: cart_items Users can update their own cart items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own cart items" ON public.cart_items FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: product_reviews Users can view all reviews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all reviews" ON public.product_reviews FOR SELECT USING (true);


--
-- Name: user_consents Users can view own consents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own consents" ON public.user_consents FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: orders Users can view own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: personalizations Users can view own personalizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own personalizations" ON public.personalizations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: users Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING ((auth.uid() = id));


--
-- Name: cart_items Users can view their own cart items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own cart items" ON public.cart_items FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: return_requests Users can view their own return requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own return requests" ON public.return_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ab_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ab_events ENABLE ROW LEVEL SECURITY;

--
-- Name: ab_experiments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ab_experiments ENABLE ROW LEVEL SECURITY;

--
-- Name: abandoned_carts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_roles admin_roles_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_roles_service_role_all ON public.admin_roles TO service_role USING (true) WITH CHECK (true);


--
-- Name: admin_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_settings admin_settings_service_role_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_settings_service_role_only ON public.admin_settings TO service_role USING (true) WITH CHECK (true);


--
-- Name: agent_daily_costs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_daily_costs ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_events_y2026m02; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_events_y2026m02 ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_events_y2026m03; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_events_y2026m03 ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_events_y2026m04; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_events_y2026m04 ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_events_y2026m05; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_events_y2026m05 ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_events_y2026m06; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_events_y2026m06 ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_events_y2026m07; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_events_y2026m07 ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_events_y2026m08; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_events_y2026m08 ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_generations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

--
-- Name: association_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.association_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: association_rules association_rules_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY association_rules_select_authenticated ON public.association_rules FOR SELECT TO authenticated USING (true);


--
-- Name: association_rules association_rules_write_service; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY association_rules_write_service ON public.association_rules TO service_role USING (true) WITH CHECK (true);


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log_y2026m02; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log_y2026m02 ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log_y2026m03; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log_y2026m03 ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log_y2026m04; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log_y2026m04 ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log_y2026m05; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log_y2026m05 ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log_y2026m06; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log_y2026m06 ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log_y2026m07; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log_y2026m07 ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log_y2026m08; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log_y2026m08 ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: brand_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brand_config ENABLE ROW LEVEL SECURITY;

--
-- Name: cart_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: collection_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;

--
-- Name: collection_products collection_products_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collection_products_admin_all ON public.collection_products TO service_role USING (true) WITH CHECK (true);


--
-- Name: collection_products collection_products_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collection_products_public_read ON public.collection_products FOR SELECT USING (true);


--
-- Name: collections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

--
-- Name: collections collections_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collections_admin_all ON public.collections TO service_role USING (true) WITH CHECK (true);


--
-- Name: collections collections_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collections_public_read ON public.collections FOR SELECT USING ((status = 'active'::text));


--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_tenant_select ON public.conversations FOR SELECT USING (((auth.role() = 'service_role'::text) OR ((auth.uid() = user_id) AND ((public.get_current_tenant_id() IS NULL) OR (tenant_id = public.get_current_tenant_id())))));


--
-- Name: conversations conversations_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_user_insert ON public.conversations FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: conversations conversations_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_user_update ON public.conversations FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: coupon_uses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupon_uses ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_transactions credit_transactions_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_transactions_service_role_all ON public.credit_transactions TO service_role USING (true) WITH CHECK (true);


--
-- Name: credit_transactions credit_transactions_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_transactions_user_select ON public.credit_transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: cron_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: cron_runs cron_runs_service_role_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cron_runs_service_role_only ON public.cron_runs TO service_role USING (true) WITH CHECK (true);


--
-- Name: customer_segments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_segments customer_segments_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_segments_service_role_all ON public.customer_segments TO service_role USING (true) WITH CHECK (true);


--
-- Name: daily_portfolio_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_portfolio_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: demand_forecasts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.demand_forecasts ENABLE ROW LEVEL SECURITY;

--
-- Name: demand_forecasts demand_forecasts_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY demand_forecasts_service_role_all ON public.demand_forecasts TO service_role USING (true) WITH CHECK (true);


--
-- Name: design_clipart; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.design_clipart ENABLE ROW LEVEL SECURITY;

--
-- Name: design_clipart design_clipart_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY design_clipart_select_authenticated ON public.design_clipart FOR SELECT TO authenticated USING (true);


--
-- Name: design_clipart design_clipart_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY design_clipart_select_public ON public.design_clipart FOR SELECT USING ((is_active = true));


--
-- Name: design_compositions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.design_compositions ENABLE ROW LEVEL SECURITY;

--
-- Name: design_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.design_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: design_templates_library; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.design_templates_library ENABLE ROW LEVEL SECURITY;

--
-- Name: design_templates_library design_templates_library_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY design_templates_library_select_authenticated ON public.design_templates_library FOR SELECT TO authenticated USING (true);


--
-- Name: design_templates_library design_templates_library_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY design_templates_library_select_public ON public.design_templates_library FOR SELECT USING ((is_active = true));


--
-- Name: designs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;

--
-- Name: designs designs_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY designs_service_role_all ON public.designs TO service_role USING (true) WITH CHECK (true);


--
-- Name: designs designs_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY designs_user_delete ON public.designs FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: designs designs_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY designs_user_insert ON public.designs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: designs designs_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY designs_user_select ON public.designs FOR SELECT USING (((auth.uid() = user_id) OR (((privacy_level)::text = 'public'::text) AND ((moderation_status)::text = 'approved'::text))));


--
-- Name: designs designs_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY designs_user_update ON public.designs FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: drip_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drip_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: drip_queue drip_queue_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY drip_queue_service_role_all ON public.drip_queue TO service_role USING (true) WITH CHECK (true);


--
-- Name: error_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: error_logs error_logs_service_role_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY error_logs_service_role_update ON public.error_logs FOR UPDATE TO service_role USING (true) WITH CHECK (true);


--
-- Name: heartbeat_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.heartbeat_events ENABLE ROW LEVEL SECURITY;

--
-- Name: heartbeat_events heartbeat_events_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY heartbeat_events_service_role_all ON public.heartbeat_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: hero_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hero_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: hero_campaigns hero_campaigns_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hero_campaigns_admin_all ON public.hero_campaigns TO service_role USING (true) WITH CHECK (true);


--
-- Name: hero_campaigns hero_campaigns_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hero_campaigns_public_read ON public.hero_campaigns FOR SELECT USING ((status = 'active'::text));


--
-- Name: legal_page_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.legal_page_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: legal_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.legal_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: legal_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.legal_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_content ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_content marketing_content_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_content_service_role_all ON public.marketing_content TO service_role USING (true) WITH CHECK (true);


--
-- Name: message_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_user_insert ON public.messages FOR INSERT WITH CHECK ((conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE (conversations.user_id = auth.uid()))));


--
-- Name: messages messages_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_user_select ON public.messages FOR SELECT USING ((conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE (conversations.user_id = auth.uid()))));


--
-- Name: messages_y2026m02; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages_y2026m02 ENABLE ROW LEVEL SECURITY;

--
-- Name: messages_y2026m03; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages_y2026m03 ENABLE ROW LEVEL SECURITY;

--
-- Name: messages_y2026m04; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages_y2026m04 ENABLE ROW LEVEL SECURITY;

--
-- Name: messages_y2026m05; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages_y2026m05 ENABLE ROW LEVEL SECURITY;

--
-- Name: messages_y2026m06; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages_y2026m06 ENABLE ROW LEVEL SECURITY;

--
-- Name: messages_y2026m07; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages_y2026m07 ENABLE ROW LEVEL SECURITY;

--
-- Name: messages_y2026m08; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages_y2026m08 ENABLE ROW LEVEL SECURITY;

--
-- Name: messaging_channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messaging_channels ENABLE ROW LEVEL SECURITY;

--
-- Name: messaging_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messaging_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_campaigns newsletter_campaigns_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY newsletter_campaigns_service_role_all ON public.newsletter_campaigns TO service_role USING (true) WITH CHECK (true);


--
-- Name: newsletter_subscribers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_subscribers newsletter_subscribers_service_role_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY newsletter_subscribers_service_role_only ON public.newsletter_subscribers TO service_role USING (true) WITH CHECK (true);


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items order_items_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_items_service_role_all ON public.order_items TO service_role USING (true) WITH CHECK (true);


--
-- Name: order_items order_items_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_items_user_select ON public.order_items FOR SELECT USING ((order_id IN ( SELECT orders.id
   FROM public.orders
  WHERE (orders.user_id = auth.uid()))));


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_tenant_select ON public.orders FOR SELECT USING (((auth.role() = 'service_role'::text) OR ((auth.uid() = user_id) AND ((public.get_current_tenant_id() IS NULL) OR (tenant_id = public.get_current_tenant_id())))));


--
-- Name: orders orders_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_user_insert ON public.orders FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: personalizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.personalizations ENABLE ROW LEVEL SECURITY;

--
-- Name: personalizations personalizations_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY personalizations_user_insert ON public.personalizations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: price_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

--
-- Name: price_history price_history_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY price_history_service_role_all ON public.price_history TO service_role USING (true) WITH CHECK (true);


--
-- Name: processed_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.processed_events ENABLE ROW LEVEL SECURITY;

--
-- Name: processed_events processed_events_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processed_events_service_role_all ON public.processed_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: product_beliefs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_beliefs ENABLE ROW LEVEL SECURITY;

--
-- Name: product_daily_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_daily_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: product_labels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_labels ENABLE ROW LEVEL SECURITY;

--
-- Name: product_lifecycle_decisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_lifecycle_decisions ENABLE ROW LEVEL SECURITY;

--
-- Name: product_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: product_reviews product_reviews_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_reviews_user_insert ON public.product_reviews FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: product_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: product_variants product_variants_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_variants_public_read ON public.product_variants FOR SELECT USING (true);


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: products products_tenant_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_tenant_select ON public.products FOR SELECT USING (((auth.role() = 'service_role'::text) OR (public.get_current_tenant_id() IS NULL) OR (tenant_id = public.get_current_tenant_id())));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions push_subscriptions_user_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_user_delete ON public.push_subscriptions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: push_subscriptions push_subscriptions_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_user_insert ON public.push_subscriptions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: push_subscriptions push_subscriptions_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_user_select ON public.push_subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: push_subscriptions push_subscriptions_user_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_user_update ON public.push_subscriptions FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

--
-- Name: referrals referrals_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY referrals_service_role_all ON public.referrals TO service_role USING (true) WITH CHECK (true);


--
-- Name: referrals referrals_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY referrals_user_insert ON public.referrals FOR INSERT WITH CHECK ((auth.uid() = referrer_id));


--
-- Name: referrals referrals_user_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY referrals_user_select ON public.referrals FOR SELECT USING (((auth.uid() = referrer_id) OR (auth.uid() = referred_id)));


--
-- Name: return_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: return_requests return_requests_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY return_requests_user_insert ON public.return_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: returns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

--
-- Name: returns returns_service_role_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY returns_service_role_only ON public.returns TO service_role USING (true) WITH CHECK (true);


--
-- Name: seo_meta_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seo_meta_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log service_role_audit_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_audit_log ON public.audit_log USING ((auth.role() = 'service_role'::text));


--
-- Name: conversations service_role_conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_conversations ON public.conversations USING ((auth.role() = 'service_role'::text));


--
-- Name: message_feedback service_role_feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_feedback ON public.message_feedback USING ((auth.role() = 'service_role'::text));


--
-- Name: error_logs service_role_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access ON public.error_logs TO service_role USING (true) WITH CHECK (true);


--
-- Name: credit_transactions service_role_full_access_credit_transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access_credit_transactions ON public.credit_transactions TO service_role USING (true) WITH CHECK (true);


--
-- Name: messages service_role_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_messages ON public.messages USING ((auth.role() = 'service_role'::text));


--
-- Name: shipping_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_zones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_zones shipping_zones_read_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shipping_zones_read_policy ON public.shipping_zones FOR SELECT USING ((active = true));


--
-- Name: soul_change_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.soul_change_log ENABLE ROW LEVEL SECURITY;

--
-- Name: soul_change_log soul_change_log_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY soul_change_log_service_role_all ON public.soul_change_log TO service_role USING (true) WITH CHECK (true);


--
-- Name: store_themes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_themes ENABLE ROW LEVEL SECURITY;

--
-- Name: store_themes store_themes_service_role_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY store_themes_service_role_update ON public.store_themes FOR UPDATE TO service_role USING (true) WITH CHECK (true);


--
-- Name: system_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

--
-- Name: system_events system_events_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_events_service_role_all ON public.system_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: telegram_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_configs tenant_configs_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_configs_owner_select ON public.tenant_configs FOR SELECT TO authenticated USING ((tenant_id IN ( SELECT tenants.id
   FROM public.tenants
  WHERE (tenants.owner_id = auth.uid()))));


--
-- Name: tenant_configs tenant_configs_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_configs_service_role_all ON public.tenant_configs TO service_role USING (true) WITH CHECK (true);


--
-- Name: tenant_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_members tenant_members_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_members_delete_policy ON public.tenant_members FOR DELETE USING (((tenant_id IN ( SELECT tenants.id
   FROM public.tenants
  WHERE (tenants.owner_id = auth.uid()))) OR (tenant_id IN ( SELECT tenant_members_1.tenant_id
   FROM public.tenant_members tenant_members_1
  WHERE ((tenant_members_1.user_id = auth.uid()) AND ((tenant_members_1.role)::text = ANY (ARRAY[('owner'::character varying)::text, ('admin'::character varying)::text])))))));


--
-- Name: tenant_members tenant_members_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_members_insert_policy ON public.tenant_members FOR INSERT WITH CHECK (((tenant_id IN ( SELECT tenants.id
   FROM public.tenants
  WHERE (tenants.owner_id = auth.uid()))) OR (tenant_id IN ( SELECT tenant_members_1.tenant_id
   FROM public.tenant_members tenant_members_1
  WHERE ((tenant_members_1.user_id = auth.uid()) AND ((tenant_members_1.role)::text = ANY (ARRAY[('owner'::character varying)::text, ('admin'::character varying)::text])))))));


--
-- Name: tenant_members tenant_members_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_members_select_policy ON public.tenant_members FOR SELECT USING (((tenant_id IN ( SELECT tenants.id
   FROM public.tenants
  WHERE (tenants.owner_id = auth.uid()))) OR (tenant_id IN ( SELECT tenant_members_1.tenant_id
   FROM public.tenant_members tenant_members_1
  WHERE (tenant_members_1.user_id = auth.uid())))));


--
-- Name: tenant_members tenant_members_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_members_update_policy ON public.tenant_members FOR UPDATE USING (((tenant_id IN ( SELECT tenants.id
   FROM public.tenants
  WHERE (tenants.owner_id = auth.uid()))) OR (tenant_id IN ( SELECT tenant_members_1.tenant_id
   FROM public.tenant_members tenant_members_1
  WHERE ((tenant_members_1.user_id = auth.uid()) AND ((tenant_members_1.role)::text = ANY (ARRAY[('owner'::character varying)::text, ('admin'::character varying)::text])))))));


--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants tenants_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenants_delete_policy ON public.tenants FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: tenants tenants_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenants_insert_policy ON public.tenants FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: tenants tenants_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenants_select_policy ON public.tenants FOR SELECT USING (((owner_id = auth.uid()) OR (id IN ( SELECT tenant_members.tenant_id
   FROM public.tenant_members
  WHERE (tenant_members.user_id = auth.uid())))));


--
-- Name: tenants tenants_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenants_update_policy ON public.tenants FOR UPDATE USING (((owner_id = auth.uid()) OR (id IN ( SELECT tenant_members.tenant_id
   FROM public.tenant_members
  WHERE ((tenant_members.user_id = auth.uid()) AND ((tenant_members.role)::text = ANY (ARRAY[('owner'::character varying)::text, ('admin'::character varying)::text])))))));


--
-- Name: translations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

--
-- Name: translations translations_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY translations_public_read ON public.translations FOR SELECT USING (true);


--
-- Name: translations translations_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY translations_service_role_all ON public.translations TO service_role USING (true) WITH CHECK (true);


--
-- Name: user_consents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

--
-- Name: user_design_assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_design_assets ENABLE ROW LEVEL SECURITY;

--
-- Name: user_messaging_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_messaging_links ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_service_role_all ON public.user_roles TO service_role USING (true) WITH CHECK (true);


--
-- Name: user_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_hide_deleted; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_hide_deleted ON public.users FOR SELECT USING ((deleted_at IS NULL));


--
-- Name: message_feedback users_own_feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_own_feedback ON public.message_feedback USING ((user_id = auth.uid()));


--
-- Name: credit_transactions users_read_own_credits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_read_own_credits ON public.credit_transactions FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: whatsapp_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: wishlist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

--
-- Name: wishlists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

