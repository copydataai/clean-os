"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@clean-os/convex/api";
import { useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home09Icon,
  Invoice02Icon,
  InboxIcon,
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
  { label: "Requests", href: "/dashboard/requests", icon: InboxIcon },
  { label: "Bookings", href: "/dashboard/bookings", icon: CalendarCheckIn01Icon },
  { label: "Schedule", href: "/dashboard/schedule", icon: Calendar03Icon },
  { label: "Cleaners", href: "/dashboard/cleaners", icon: UserGroupIcon },
  { label: "Customers", href: "/dashboard/customers", icon: ContactIcon },
  { label: "Payments", href: "/dashboard/payments", icon: CreditCardIcon },
  { label: "Settings", href: "/dashboard/settings", icon: Settings02Icon },
];

// Custom error hook for dashboard-specific error handling
function useDashboardErrorHandler() {
  const [error, setError] = useState<Error | null>(null);
  const [errorInfo, setErrorInfo] = useState<string>("");

  const resetError = () => {
    setError(null);
    setErrorInfo("");
  };

  const handleError = (error: Error, context?: string) => {
    console.error(`Dashboard Error${context ? ` in ${context}` : ""}:`, error);
    setError(error);
    setErrorInfo(context || "Unknown context");
  };

  return { error, errorInfo, handleError, resetError };
}

// Dashboard-specific error component with contextual actions
function DashboardError({ 
  error, 
  onRetry, 
  context 
}: { 
  error: Error; 
  onRetry: () => void;
  context: string;
}) {
  const isNetworkError = error.message.includes("network") || error.message.includes("fetch");
  const isAuthError = error.message.includes("unauthorized") || error.message.includes("authentication");

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card/80 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Dashboard Error
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-foreground">
        {isNetworkError ? "Connection issue" : isAuthError ? "Authentication required" : "Something went wrong"}
      </h2>
      
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {isNetworkError 
          ? "Unable to connect to the dashboard. Please check your internet connection and try again."
          : isAuthError
          ? "Your session has expired. Please sign in again to access the dashboard."
          : error.message || "An unexpected error occurred while loading the dashboard."}
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          onClick={onRetry}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {isNetworkError ? "Try again" : "Reload dashboard"}
        </button>
        
        {isAuthError && (
          <button
            onClick={() => window.location.href = "/sign-in"}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Sign in
          </button>
        )}
        
        <button
          onClick={() => window.location.href = "/support"}
          className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
        >
          Get help
        </button>
      </div>

      {process.env.NODE_ENV === "development" && (
        <details className="mt-6 text-left">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            Error details (development only)
          </summary>
          <div className="mt-2 rounded-md bg-muted p-3 text-xs font-mono text-foreground">
            <div className="font-semibold">Context: {context}</div>
            <div className="mt-1">{error.message}</div>
            {error.stack && (
              <div className="mt-2 whitespace-pre-wrap opacity-70">{error.stack}</div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

// Design tokens for consistent spacing and sizing
const DESIGN_TOKENS = {
  logo: { size: 'h-9 w-9' },
  userAvatar: { size: 'h-7 w-7' },
  loadingSpinner: { size: 'h-8 w-8' },
} as const;

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { error, errorInfo, handleError, resetError } = useDashboardErrorHandler();
  
  // Safe query wrapper with error handling
  const currentUser = useQuery(api.queries.getCurrentUser);
  const {
    activeOrg,
    hasNoOrganizations,
    isLoading,
    isOrgContextReady,
    isResolvingOrgContext,
  } = useActiveOrganization();

  // Handle query errors
  useEffect(() => {
    if (currentUser === null) {
      handleError(new Error("Failed to load user data"), "User Query");
    }
  }, [currentUser, handleError]);

  const userInitial =
    currentUser?.firstName?.[0] ?? currentUser?.email?.[0] ?? "C";

  return (
    <SidebarProvider>
      <Sidebar
        collapsible="icon"
        variant="inset"
        className="border-r border-sidebar-border/70 transition-all duration-300 ease-in-out"
      >
        <SidebarHeader className="border-b border-sidebar-border/80 px-2 py-3 transition-all duration-300 ease-in-out">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-all duration-300 ease-in-out hover:bg-sidebar-accent/70"
          >
            <div className={`flex ${DESIGN_TOKENS.logo.size} items-center justify-center rounded-xl bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground transition-all duration-300 ease-in-out`}>
              KC
            </div>
            <div className="flex min-w-0 flex-col transition-all duration-300 ease-in-out">
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                KathyClean OS
              </span>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent className="py-3 transition-all duration-300 ease-in-out">
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
                          className="transition-all duration-200 ease-in-out"
                        >
                          <HugeiconsIcon icon={item.icon} size={20} className="text-muted-foreground" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      ) : (
                        <Link href={item.href} className="w-full transition-all duration-200 ease-in-out">
                          <SidebarMenuButton isActive={isActive} tooltip={item.label} className="transition-all duration-200 ease-in-out">
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
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur md:px-6 transition-all duration-300 ease-in-out">
          <div className="page-width flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {activeOrg?.name ?? (isLoading ? "Loading organization" : "No organization")}
                </p>
                <p className="text-xs text-muted-foreground">
                  Requests, scheduling, teams, and customers
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:flex">
              <div className={`flex ${DESIGN_TOKENS.userAvatar.size} items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground`}>
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
            {error ? (
              <DashboardError 
                error={error} 
                onRetry={resetError}
                context={errorInfo}
              />
            ) : (
              <>
                {hasNoOrganizations ? (
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
            ) : !isOrgContextReady ? (
              <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card/80 p-8 text-center">
                <div className={`mx-auto ${DESIGN_TOKENS.loadingSpinner.size} animate-spin rounded-full border-2 border-primary border-t-transparent`} />
                <h2 className="mt-4 text-2xl font-semibold text-foreground">
                  Preparing organization context
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {isResolvingOrgContext
                    ? "Please wait while we sync your active organization."
                    : "Finalizing dashboard workspace access."}
                </p>
              </div>
                ) : (
                  children
                )}
              </>
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
