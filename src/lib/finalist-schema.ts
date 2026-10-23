import { z } from "zod";

// Same rules as the database constraints (see the finalists migration).
export const finalistSchema = z
  .object({
    finalist: z.boolean(),
    award: z
      .string()
      .transform((v) => v.trim())
      .pipe(z.string().max(60, "Use at most 60 characters.")),
    rank: z
      .union([z.string(), z.number(), z.null()])
      .transform((v) => (v === null || v === "" ? null : Number(v)))
      .pipe(z.number().int().min(1).max(99).nullable()),
  })
  .transform((v) =>
    v.finalist
      ? { finalist: true, award: v.award || null, rank: v.rank }
      : { finalist: false, award: null, rank: null },
  )
  .refine((v) => v.award === null || v.award.length >= 2, {
    path: ["award"],
    message: "Use at least 2 characters.",
  })
  .refine((v) => v.rank === null || v.award !== null, {
    path: ["rank"],
    message: "Add an award name to use a rank.",
  });
