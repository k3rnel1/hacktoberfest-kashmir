import { z } from "zod";

// Shared by the "Looking for a team" form (instant feedback) and the server action
// (the real check). The database enforces the same limits.

const tagList = z
  .string()
  .transform((value) =>
    value
      .split(/[,\n]/)
      .map((item) => item.trim().replace(/\s+/g, " "))
      .filter(Boolean),
  )
  .pipe(
    z
      .array(z.string().max(30, "Each item can be at most 30 characters."))
      .max(10, "Add at most 10 items."),
  );

export const listingSchema = z.object({
  skills: tagList.pipe(z.array(z.string()).min(1, "Add at least one skill or technology.")),
  interests: tagList,
  intro: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(300, "Use at most 300 characters.")),
  preferredRole: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .max(40, "Use at most 40 characters.")
        .refine((v) => v === "" || v.length >= 2, "Use at least 2 characters."),
    ),
  portfolioUrl: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z.string().refine((v) => {
        if (v === "") return true;
        if (!/^https:\/\/[^\s]{4,200}$/.test(v)) return false;
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      }, "Enter a link starting with https://"),
    ),
});

export type ListingInput = z.infer<typeof listingSchema>;
