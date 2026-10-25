import { z } from "zod";

// GitHub repository links only: https://github.com/<owner>/<repo>. The database applies
// the same rule, so nothing else can be stored.
const REPO_PATTERN =
  /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;

export function normalizeRepoUrl(input: string): string {
  return input
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
}

export const projectRepoSchema = z.object({
  repoUrl: z
    .string()
    .transform(normalizeRepoUrl)
    .pipe(
      z
        .string()
        .max(200, "That link is too long.")
        .refine(
          (v) =>
            v === "" ||
            (REPO_PATTERN.test(v) && ![".", ".."].includes(v.split("/")[4])),
          "Use a link like https://github.com/your-name/your-project",
        ),
    ),
});
