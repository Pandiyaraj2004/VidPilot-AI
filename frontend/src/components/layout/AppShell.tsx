import { MobileDrawer } from "@/components/layout/MobileDrawer";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { PageLoader } from "@/components/ui/LoadingState";
import { useState } from "react";
import { Outlet, useNavigation } from "react-router-dom";

export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigation = useNavigation();

  return (
    <div className="flex h-svh flex-col bg-background">
      <TopBar onOpenMenu={() => setMobileMenuOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          {navigation.state === "loading" ? <PageLoader /> : <Outlet />}
        </main>
      </div>
      <MobileDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </div>
  );
}
