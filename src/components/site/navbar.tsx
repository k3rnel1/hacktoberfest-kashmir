import Link from "next/link";
import { Menu } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { Logo } from "./logo";

export async function Navbar() {
  const user = await getSessionUser();
  const admin = user ? await isAdmin(user.id) : false;

  const links = user
    ? [
        { href: admin ? "/admin" : "/dashboard", label: admin ? "Admin" : "Dashboard" },
        ...(admin ? [] : [{ href: "/settings/profile", label: "Profile" }]),
      ]
    : [];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
          {links.map((link) => (
            <Button key={link.href} asChild variant="ghost" size="sm">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
          {user ? (
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Log out
              </Button>
            </form>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
        </nav>

        <details className="group relative sm:hidden">
          <summary
            className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-border hover:bg-surface-2 [&::-webkit-details-marker]:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </summary>
          <div className="absolute right-0 mt-2 grid w-48 gap-1 rounded-lg border border-border bg-surface p-2 shadow-xl">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm hover:bg-surface-2"
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2"
                >
                  Log out
                </button>
              </form>
            ) : (
              <>
                <Link href="/login" className="rounded-md px-3 py-2 text-sm hover:bg-surface-2">
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </details>
      </div>
    </header>
  );
}
