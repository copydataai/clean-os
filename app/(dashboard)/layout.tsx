"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navItems = [
  { label: "Overview", href: "/dashboard" },
  { label: "Quotes", href: "/dashboard/quotes" },
  { label: "Requests", href: "/dashboard/requests" },
  { label: "Bookings", href: "/dashboard/bookings" },
  { label: "Schedule", href: "/dashboard/schedule" },
  { label: "Cleaners", href: "/dashboard/cleaners" },
  { label: "Customers", href: "/dashboard/customers" },
  { label: "Payments", href: "/dashboard/payments", disabled: true },
  { label: "Settings", href: "/dashboard/settings", disabled: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentUser = useQuery(api.queries.getCurrentUser);
  const organizations = useQuery(api.queries.getUserOrganizations);

  const primaryOrg = organizations?.[0];
  const userInitial =
    currentUser?.firstName?.[0] ?? currentUser?.email?.[0] ?? "C";

  return (
    <SidebarProvider>
      <Sidebar
        collapsible="icon"
        variant="inset"
        className="border-r border-sidebar-border/70"
      >
        <SidebarHeader className="border-b border-sidebar-border/80 px-2 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-sidebar-accent/70"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
              CO
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                Clean OS
              </span>
              <span className="truncate text-xs text-muted-foreground">
                Operations command center
              </span>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent className="py-3">
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === item.href
                      : pathname?.startsWith(item.href);

                  return (
                    <SidebarMenuItem key={item.href}>
                      {item.disabled ? (
                        <SidebarMenuButton
                          isActive={isActive}
                          disabled
                          tooltip={item.label}
                        >
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
                            {item.label.charAt(0)}
                          </span>
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      ) : (
                        <Link href={item.href} className="w-full">
                          <SidebarMenuButton isActive={isActive} tooltip={item.label}>
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sidebar-accent text-[10px] font-semibold text-sidebar-foreground/80">
                              {item.label.charAt(0)}
                            </span>
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </Link>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border/80 px-2 py-3">
          {currentUser ? (
            <div className="rounded-xl border border-sidebar-border bg-sidebar px-3 py-2">
              <p className="truncate text-xs font-medium text-sidebar-foreground">
                {currentUser.firstName ?? currentUser.email}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">Operator</p>
            </div>
          ) : (
            <div className="px-2 py-1 text-xs text-muted-foreground">v1.0.0</div>
          )}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-transparent">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur md:px-6">
          <div className="page-width flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {primaryOrg?.name ?? "Cleaning Operations"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Requests, scheduling, teams, and customers
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {userInitial.toUpperCase()}
              </div>
              <span className="max-w-[180px] truncate text-xs text-muted-foreground">
                {currentUser?.firstName ?? currentUser?.email ?? "Loading user"}
              </span>
            </div>
          </div>
        </header>

        <div className="min-h-[calc(100vh-72px)] px-4 py-6 sm:px-6 sm:py-8">
          <div className="page-width">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
