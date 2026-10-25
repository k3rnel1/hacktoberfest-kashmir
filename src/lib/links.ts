// Link helpers that are safe to import from both server and client components.
// Values come from the database, which already enforces these formats; checking again
// at render time means a bad value can never become a clickable javascript: link.

const LINKEDIN_PROFILE = /^https:\/\/www\.linkedin\.com\/in\/[A-Za-z0-9_%-]{3,100}\/?$/;
const INTERNAL_PATH = /^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;

/** The LinkedIn profile URL if it is a well-formed linkedin.com/in/ link, else null. */
export function linkedinHref(url: string | null | undefined): string | null {
  return url && LINKEDIN_PROFILE.test(url) ? url : null;
}

/** An in-app path such as /teams/requests, else null (never an external URL). */
export function internalHref(path: string | null | undefined): string | null {
  return path && INTERNAL_PATH.test(path) ? path : null;
}
