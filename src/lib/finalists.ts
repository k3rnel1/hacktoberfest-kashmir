import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type PublicFinalist = {
  name: string;
  description: string;
  award: string | null;
  award_rank: number | null;
  members: string[];
};

// Public data: team name, description, award and member names only. The database
// function never returns ids, contact details or links.
export async function getFinalists(): Promise<PublicFinalist[]> {
  const { data, error } = await createAdminClient().rpc("public_finalists");
  if (error) throw new Error("Failed to load finalists");
  return (data ?? []) as PublicFinalist[];
}
