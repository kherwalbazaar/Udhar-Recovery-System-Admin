import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function savePayableAmount(amount: number): Promise<void> {
  const client = supabase;
  if (!client) {
    throw new Error("Supabase is not configured.");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("The final payable amount must be greater than zero.");
  }

  const { error } = await client
    .from("amount_value")
    .insert({ amount: Number(amount.toFixed(2)) });

  if (error) {
    console.error("Failed to save the sale amount to Supabase", error);
    throw new Error(
      error.code === "42501"
        ? "Supabase denied the write. Verify that this staff account is authorized."
        : "Could not sync the payable amount to Supabase."
    );
  }
}
