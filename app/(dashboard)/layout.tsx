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
  { label: "Quotes", href: "/quotes" },
  { label: "Requests", href: "/requests" },
  { label: "Bookings", href: "/bookings" },
  { label: "Payments", href: "/payments", disabled: true },
  { label: "Settings", href: "/settings", disabled: true },
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
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-[#1A1A1A]" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[#1A1A1A]">
                Clean OS
              </span>
              <span className="text-xs text-[#777777]">Operations</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="py-2">
          <SidebarGroup>
            <SidebarGroupLabel>Manage</SidebarGroupLabel>
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
                          <span className="h-2 w-2 rounded-full bg-[#1A1A1A] opacity-40" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      ) : (
                        <Link href={item.href} className="w-full">
                          <SidebarMenuButton
                            isActive={isActive}
                            tooltip={item.label}
                          >
                            <span className="h-2 w-2 rounded-full bg-[#1A1A1A] opacity-40" />
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
        <SidebarFooter className="border-t border-sidebar-border">
          <div className="px-2 py-3 text-xs text-[#888888]">v1.0.0</div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="flex items-center justify-between border-b border-[#E5E5E5] bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div>
              <p className="text-sm font-medium text-[#1A1A1A]">
                {primaryOrg?.name ?? "Cleaning Operations"}
              </p>
              <p className="text-xs text-[#777777]">
                Manage requests and bookings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2 rounded-full bg-[#F5F5F5] px-3 py-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A1A1A] text-xs font-medium text-white">
                  {userInitial.toUpperCase()}
                </div>
                <span className="text-xs text-[#444444]">
                  {currentUser.firstName ?? currentUser.email}
                </span>
              </div>
            ) : null}
          </div>
        </header>

        <div className="min-h-[calc(100vh-72px)] bg-[#FAFAFA] px-6 py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
