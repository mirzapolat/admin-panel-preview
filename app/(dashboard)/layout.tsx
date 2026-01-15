import { Sidebar } from "@/components/dashboard/Sidebar";
import AuthGuard from "@/components/AuthGuard";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <Sidebar className="hidden lg:flex" />
        
        <main className="flex-1 overflow-auto">
           {/* Mobile Header */}
           <div className="flex bg-background items-center gap-3 p-4 lg:hidden border-b">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-64">
                   <SheetHeader className="sr-only">
                     <SheetTitle>Navigation</SheetTitle>
                     <SheetDescription>Dashboard-Menue</SheetDescription>
                   </SheetHeader>
                   <Sidebar className="w-full border-none" />
                </SheetContent>
              </Sheet>
              <h1 className="font-bold text-lg">Admin Panel</h1>
           </div>
          <div className="h-full p-8">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
