import { Suspense } from "react";
import { Footer } from "@/components/site/footer";
import { Logo } from "@/components/site/logo";
import { Navbar } from "@/components/site/navbar";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense
        fallback={
          <header className="border-b border-border">
            <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
              <Logo />
            </div>
          </header>
        }
      >
        <Navbar />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <Footer />
    </>
  );
}
