import { AppSidebar } from "./AppSidebar";
import { NotificationCenter } from "./NotificationCenter";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="lg:pl-60">
        {/* Fixed notification bell - top right */}
        <div className="fixed right-5 top-3 z-30 lg:right-7">
          <NotificationCenter />
        </div>
        <div className="min-h-screen p-5 lg:p-7">{children}</div>
      </main>
    </div>
  );
}
