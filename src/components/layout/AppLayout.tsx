import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="lg:pl-60">
        <div className="min-h-screen pt-14 px-3 pb-4 sm:px-5 sm:pb-5 lg:pt-5 lg:px-7 lg:pb-7">{children}</div>
      </main>
    </div>
  );
}
