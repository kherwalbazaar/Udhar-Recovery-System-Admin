# Supabase sale amount sync

The Sales page appends the final payable amount to `public.amount_value` after
the sale has been saved to Firebase. The latest row remains the amount consumed
by the QR poster. No other Supabase table is used for this feature.

1. Set `NEXT_PUBLIC_SUPABASE_URL` and either
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   in `.env.local`.
2. Apply the migrations in `supabase/migrations/` in filename order.
3. Create an email/password staff user in Supabase Auth.
4. Migration `20261108000003_admin_users_amount_access.sql` updates or inserts
   `balakramtudu1993@gmail.com` in the existing `public.admin_users` table with
   the `admin` role. It expects that table to already exist with the columns
   `id`, `email`, `role`, `created_at`, and optional `user_id`.
5. Supabase inserts remain restricted to authenticated admin users. The Sales
   page itself does not require sign-in; after a Firebase sale, the page offers
   an optional Supabase admin sign-in if amount sync is needed. A pending amount
   retries after successful admin authentication. Public inserts are not enabled.

Only authenticated users matching an admin row in `public.admin_users` can
insert payment amounts. Anonymous users and other signed-in users cannot write
to `amount_value`. The app uses `public.admin_users` for access control and
`public.amount_value` for sale amounts; it does not create another table.
