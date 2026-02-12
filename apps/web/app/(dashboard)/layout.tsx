"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home09Icon,
  Invoice02Icon,
  Calendar03Icon,
  CalendarCheckIn01Icon,
  UserGroupIcon,
  ContactIcon,
  CreditCardIcon,
  Settings02Icon,
} from "@hugeicons/core-free-icons";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import ActiveOrganizationProvider from "@/components/org/ActiveOrganizationProvider";
import { useActiveOrganization } from "@/components/org/useActiveOrganization";
import OrganizationSwitcher from "@/components/dashboard/OrganizationSwitcher";

type NavItem = {
  label: string;
  href: string;
  icon: typeof Home09Icon;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: Home09Icon },
  { label: "Quotes", href: "/dashboard/quotes", icon: Invoice02Icon },
  { label: "Onboarding", href: "/dashboard/onboarding", icon: CalendarCheckIn01Icon },
  { label: "Schedule", href: "/dashboard/schedule", icon: Calendar03Icon },
  { label: "Cleaners", href: "/dashboard/cleaners", icon: UserGroupIcon },
  { label: "Customers", href: "/dashboard/customers", icon: ContactIcon },
  { label: "Payments", href: "/dashboard/payments", icon: CreditCardIcon },
  { label: "Settings", href: "/dashboard/settings", icon: Settings02Icon },
];

function NoOrganizationCard() {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card/80 p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Organization access required
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-foreground">No organizations found</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Your account is signed in, but it is not assigned to an organization yet.
        Ask your admin to send an invite or create an organization in Clerk.
      </p>
    </div>
  );
}

function OrgLoadingCard({ isResolvingOrgContext }: { isResolvingOrgContext: boolean }) {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card/80 p-8 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <h2 className="mt-4 text-2xl font-semibold text-foreground">
        Preparing organization context
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {isResolvingOrgContext
          ? "Please wait while we sync your active organization."
          : "Finalizing dashboard workspace access."}
      </p>
    </div>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentUser = useQuery(api.queries.getCurrentUser);
  const {
    activeOrg,
    hasNoOrganizations,
    isLoading,
    isOrgContextReady,
    isResolvingOrgContext,
  } = useActiveOrganization();

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
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-sidebar-accent/70"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
              KC
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                KathyClean OS
              </span>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent className="py-3">
          <SidebarGroup>
            <SidebarGroupLabel>Organization</SidebarGroupLabel>
            <SidebarGroupContent>
              <OrganizationSwitcher />
            </SidebarGroupContent>
          </SidebarGroup>

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
                          <HugeiconsIcon icon={item.icon} size={20} className="text-muted-foreground" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      ) : (
                        <Link href={item.href} className="w-full">
                          <SidebarMenuButton isActive={isActive} tooltip={item.label} className="transition-colors">
                            <HugeiconsIcon icon={item.icon} size={20} className={isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/60"} />
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
      </Sidebar>

      <SidebarInset className="bg-transparent">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur md:px-6">
          <div className="page-width flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {activeOrg?.name ?? (isLoading ? "Loading organization" : "No organization")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Onboarding, scheduling, teams, and customers
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
          <div className="page-width">
            {hasNoOrganizations ? (
              <NoOrganizationCard />
            ) : !isOrgContextReady ? (
              <OrgLoadingCard isResolvingOrgContext={isResolvingOrgContext} />
            ) : (
              children
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ActiveOrganizationProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </ActiveOrganizationProvider>
  );
}
