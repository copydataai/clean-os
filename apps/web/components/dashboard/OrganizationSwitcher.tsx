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
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

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

function OrganizationAvatar({
  name,
  imageUrl,
  isActive,
  compact = false,
}: {
  name?: string;
  imageUrl?: string;
  isActive?: boolean;
  compact?: boolean;
}) {
  const sizeClass = compact ? "h-7 w-7" : "h-8 w-8";
  const textClass = compact ? "text-[10px]" : "text-xs";

  if (imageUrl) {
    return (
      <span
        className={cn(
          "overflow-hidden rounded-lg ring-1 ring-border/80",
          sizeClass
        )}
      >
        <img src={imageUrl} alt={name ?? "Organization"} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-lg font-semibold",
        sizeClass,
        textClass,
        isActive
          ? "bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20"
          : "bg-gradient-to-br from-sidebar-accent to-muted text-sidebar-foreground"
      )}
    >
      {getInitials(name)}
    </span>
  );
}

function SwitchingDot({ spinning }: { spinning: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-2.5 w-2.5 rounded-full",
        spinning
          ? "animate-pulse bg-amber-500"
          : "bg-emerald-500"
      )}
    />
  );
}

export default function OrganizationSwitcher() {
  const { activeOrg, organizations, isLoading, isSwitching, switchOrganization } =
    useActiveOrganization();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                tooltip={activeOrg?.name ?? "Organization"}
                className="h-12 border border-sidebar-border/60 bg-sidebar/60 px-2 data-[state=open]:bg-sidebar-accent/70"
              />
            }
          >
            <OrganizationAvatar
              name={activeOrg?.name}
              imageUrl={activeOrg?.imageUrl}
              isActive
              compact
            />
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block truncate text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Active org
              </span>
              <span className="block truncate text-sm font-semibold text-sidebar-foreground">
                {activeOrg?.name ?? (isLoading ? "Loading organizations" : "Select organization")}
              </span>
            </span>
            <span className="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden">
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                strokeWidth={2}
                className={cn("h-4 w-4", isSwitching ? "animate-pulse" : "")}
              />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-80 rounded-xl p-2">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="rounded-lg border border-border/70 bg-muted/30 px-2 py-2 text-foreground">
                <div className="flex items-center gap-3">
                  <OrganizationAvatar
                    name={activeOrg?.name}
                    imageUrl={activeOrg?.imageUrl}
                    isActive
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Active organization
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                      {activeOrg?.name ?? "Not selected"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {activeOrg ? formatRole(activeOrg.role) : "No organization selected"}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    <SwitchingDot spinning={isSwitching} />
                    {isSwitching ? "Switching" : "Ready"}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <p className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Switch organization
              </p>
              {organizations.length === 0 ? (
                <DropdownMenuItem disabled className="rounded-lg">
                  No organizations available
                </DropdownMenuItem>
              ) : (
                organizations.map((organization) => {
                  const isActive = activeOrg?._id === organization._id;
                  return (
                    <DropdownMenuItem
                      key={organization._id}
                      className={cn(
                        "rounded-lg border border-transparent px-2.5 py-2",
                        isActive ? "border-primary/20 bg-primary/5" : "hover:border-border/80"
                      )}
                      disabled={isSwitching || isLoading}
                      onClick={async () => {
                        await switchOrganization(organization);
                      }}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <OrganizationAvatar
                          name={organization.name}
                          imageUrl={organization.imageUrl}
                          isActive={isActive}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {organization.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatRole(organization.role)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "ml-3 inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
                          isActive
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground"
                        )}
                      >
                        {isActive ? "On" : "Go"}
                      </span>
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
