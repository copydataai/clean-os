"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import type { Id } from "@clean-os/convex/data-model";
import { api } from "@clean-os/convex/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SetPayRateSheetProps = {
  cleanerId: Id<"cleaners">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PAY_TYPES = ["hourly", "per_job", "commission", "salary"];

export default function SetPayRateSheet({
  cleanerId,
  open,
  onOpenChange,
}: SetPayRateSheetProps) {
  const setPayRate = useMutation(api.cleaners.setPayRate);
  const [payType, setPayType] = useState("hourly");
  const [baseRateInput, setBaseRateInput] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [overtimeRateInput, setOvertimeRateInput] = useState("");
  const [weekendRateInput, setWeekendRateInput] = useState("");
  const [holidayRateInput, setHolidayRateInput] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseRate = (value: string): number => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return 0;
    if (payType === "commission") return parsed;
    return Math.round(parsed * 100);
  };

  const submit = async () => {
    setError(null);
    const baseRate = parseRate(baseRateInput);
    if (baseRate <= 0) {
      setError("Enter a valid base rate.");
      return;
    }

    setIsSaving(true);
    try {
      await setPayRate({
        cleanerId,
        payType,
        baseRate,
        currency,
        overtimeRate: overtimeRateInput ? parseRate(overtimeRateInput) : undefined,
        weekendRate: weekendRateInput ? parseRate(weekendRateInput) : undefined,
        holidayRate: holidayRateInput ? parseRate(holidayRateInput) : undefined,
        serviceType: serviceType || undefined,
      });
      onOpenChange(false);
      setBaseRateInput("");
      setOvertimeRateInput("");
      setWeekendRateInput("");
      setHolidayRateInput("");
      setServiceType("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to set pay rate.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Set pay rate</SheetTitle>
          <SheetDescription>
            Saving a new pay rate deactivates the current active rate automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Pay type</label>
            <Select
              value={payType}
              onValueChange={(value) => setPayType(value ?? "hourly")}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">
                Base rate ({payType === "commission" ? "%" : "USD"})
              </label>
              <Input
                type="number"
                min="0"
                step={payType === "commission" ? "0.1" : "0.01"}
                className="mt-1"
                value={baseRateInput}
                onChange={(event) => setBaseRateInput(event.target.value)}
                placeholder={payType === "commission" ? "20" : "25.00"}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Currency</label>
              <Input
                className="mt-1"
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                placeholder="USD"
                maxLength={3}
              />
            </div>
          </div>

          {payType !== "commission" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-foreground">Overtime</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1"
                  value={overtimeRateInput}
                  onChange={(event) => setOvertimeRateInput(event.target.value)}
                  placeholder="35.00"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Weekend</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1"
                  value={weekendRateInput}
                  onChange={(event) => setWeekendRateInput(event.target.value)}
                  placeholder="30.00"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Holiday</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1"
                  value={holidayRateInput}
                  onChange={(event) => setHolidayRateInput(event.target.value)}
                  placeholder="45.00"
                />
              </div>
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium text-foreground">
              Service type override (optional)
            </label>
            <Input
              className="mt-1"
              value={serviceType}
              onChange={(event) => setServiceType(event.target.value)}
              placeholder="deep"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button className="w-full" disabled={isSaving} onClick={submit}>
            {isSaving ? "Saving..." : "Save pay rate"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
