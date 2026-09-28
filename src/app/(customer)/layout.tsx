import { BottomNav } from "@/components/layout/BottomNav";
import { DemoRibbon } from "@/components/layout/DemoRibbon";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:p-3">
        Skip to content
      </a>
      <DemoRibbon />
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pt-10 lg:pb-12">
        {children}
      </main>
      <div className="pb-20 lg:pb-0">
        <SiteFooter />
      </div>
      <BottomNav />
    </>
  );
}
