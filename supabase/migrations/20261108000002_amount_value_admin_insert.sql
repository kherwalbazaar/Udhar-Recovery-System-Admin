REVOKE INSERT, UPDATE, DELETE ON public.amount_value FROM anon, authenticated;
GRANT INSERT ON public.amount_value TO authenticated;

DO $$
DECLARE
  identity_sequence text;
BEGIN
  identity_sequence := pg_get_serial_sequence('public.amount_value', 'id');
  IF identity_sequence IS NOT NULL THEN
    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE %s TO authenticated',
      identity_sequence::regclass
    );
    EXECUTE format(
      'REVOKE ALL ON SEQUENCE %s FROM anon',
      identity_sequence::regclass
    );
  END IF;
END
$$;
