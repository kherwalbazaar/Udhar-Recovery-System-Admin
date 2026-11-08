DO $$
BEGIN
  IF to_regclass('public.admin_users') IS NULL THEN
    RAISE EXCEPTION 'Required table public.admin_users does not exist';
  END IF;
END
$$;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_users TO authenticated;

DROP POLICY IF EXISTS "Admins can read their own admin user row" ON public.admin_users;
DROP POLICY IF EXISTS "Restrict admin user reads to own account" ON public.admin_users;
CREATE POLICY "Admins can read their own admin user row"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (
    role = 'admin'
    AND (
      user_id = auth.uid()
      OR (
        user_id IS NULL
        AND lower(email) = lower(auth.jwt() ->> 'email')
      )
    )
  );
CREATE POLICY "Restrict admin user reads to own account"
  ON public.admin_users
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    role = 'admin'
    AND (
      user_id = auth.uid()
      OR (
        user_id IS NULL
        AND lower(email) = lower(auth.jwt() ->> 'email')
      )
    )
  );

DROP POLICY IF EXISTS "Authorized admins can add amount values" ON public.amount_value;
DROP POLICY IF EXISTS "Restrict amount inserts to admins" ON public.amount_value;
CREATE POLICY "Authorized admins can add amount values"
  ON public.amount_value
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.admin_users
      WHERE role = 'admin'
        AND (
          user_id = auth.uid()
          OR (
            user_id IS NULL
            AND lower(email) = lower(auth.jwt() ->> 'email')
          )
        )
    )
  );
CREATE POLICY "Restrict amount inserts to admins"
  ON public.amount_value
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE role = 'admin'
          AND (
            user_id = auth.uid()
            OR (
              user_id IS NULL
              AND lower(email) = lower(auth.jwt() ->> 'email')
            )
          )
    )
  );

UPDATE public.admin_users
SET role = 'admin',
    user_id = (
      SELECT id
      FROM auth.users
      WHERE lower(email) = lower('balakramtudu1993@gmail.com')
      LIMIT 1
    )
WHERE lower(email) = lower('balakramtudu1993@gmail.com');

INSERT INTO public.admin_users (id, email, role, created_at, user_id)
SELECT
  gen_random_uuid()::text,
  'balakramtudu1993@gmail.com',
  'admin',
  now(),
  (
    SELECT id
    FROM auth.users
    WHERE lower(email) = lower('balakramtudu1993@gmail.com')
    LIMIT 1
  )
WHERE NOT EXISTS (
  SELECT 1
  FROM public.admin_users
  WHERE lower(email) = lower('balakramtudu1993@gmail.com')
);
