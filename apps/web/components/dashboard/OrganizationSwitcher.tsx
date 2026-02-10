"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useActiveOrganization } from "@/components/org/useActiveOrganization";

function getInitials(name?: string) {
  if (!name) {
    return "O";
  }

  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "O";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function formatRole(role?: string) {
  if (!role) {
    return "Member";
  }

  return role
    .replace(/[:_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((value) => value.charAt(0).toUpperCase() + value.slice(1))
    .join(" ");
}

export default function OrganizationSwitcher() {
  const { activeOrg, organizations, isLoading, isSwitching, switchOrganization } =
    useActiveOrganization();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton tooltip="Organization" />}>
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sidebar-accent text-[10px] font-semibold text-sidebar-foreground">
              {getInitials(activeOrg?.name)}
            </span>
            <span className="truncate group-data-[collapsible=icon]:hidden">
              {activeOrg?.name ?? (isLoading ? "Loading organizations" : "Select organization")}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Active organization
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">
                      {activeOrg?.name ?? "Not selected"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {activeOrg ? formatRole(activeOrg.role) : "No organization selected"}
                    </p>
                  </div>
                  <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {isSwitching ? "Switching" : "Workspace"}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {organizations.length === 0 ? (
                <DropdownMenuItem disabled>No organizations available</DropdownMenuItem>
              ) : (
                organizations.map((organization) => {
                  const isActive = activeOrg?._id === organization._id;
                  return (
                    <DropdownMenuItem
                      key={organization._id}
                      disabled={isSwitching || isLoading}
                      onClick={async () => {
                        await switchOrganization(organization);
                      }}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {getInitials(organization.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {organization.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatRole(organization.role)}
                          </p>
                        </div>
                      </div>
                      {isActive ? (
                        <span className="ml-2 text-xs font-semibold text-primary">Active</span>
                      ) : null}
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
