"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AvailabilitySlot = {
  _id: Id<"cleanerAvailability">;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

type AvailabilityEditorProps = {
  cleanerId: Id<"cleaners">;
  availability: AvailabilitySlot[];
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AvailabilityEditor({
  cleanerId,
  availability,
}: AvailabilityEditorProps) {
  const setAvailability = useMutation(api.cleaners.setAvailability);
  const removeAvailability = useMutation(api.cleaners.removeAvailability);

  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [isSaving, setIsSaving] = useState(false);

  const availabilityByDay = availability.reduce(
    (acc, slot) => {
      if (slot.isActive) {
        acc[slot.dayOfWeek] = slot;
      }
      return acc;
    },
    {} as Record<number, AvailabilitySlot>
  );

  const handleEditDay = (dayIndex: number) => {
    const existing = availabilityByDay[dayIndex];
    if (existing) {
      setStartTime(existing.startTime);
      setEndTime(existing.endTime);
    } else {
      setStartTime("09:00");
      setEndTime("17:00");
    }
    setEditingDay(dayIndex);
  };

  const handleSave = async () => {
    if (editingDay === null) return;
    setIsSaving(true);
    try {
      await setAvailability({
        cleanerId,
        dayOfWeek: editingDay,
        startTime,
        endTime,
      });
      setEditingDay(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (dayIndex: number) => {
    const slot = availabilityByDay[dayIndex];
    if (!slot) return;
    setIsSaving(true);
    try {
      await removeAvailability({ availabilityId: slot._id });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((day, index) => {
          const slot = availabilityByDay[index];
          const isAvailable = !!slot;
          const isEditing = editingDay === index;

          return (
            <div key={day} className="space-y-2">
              <div
                className={cn(
                  "rounded-lg border p-3 text-center min-h-[100px] flex flex-col justify-center",
                  isAvailable
                    ? "border-green-200 bg-green-50"
                    : "border-dashed border-border bg-background"
                )}
              >
                <p className="text-xs font-medium text-muted-foreground">{day}</p>
                {isAvailable ? (
                  <div className="mt-1">
                    <p className="text-xs text-foreground">{slot.startTime}</p>
                    <p className="text-xs text-muted-foreground">to</p>
                    <p className="text-xs text-foreground">{slot.endTime}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Off</p>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs px-1"
                  onClick={() => handleEditDay(index)}
                  disabled={isSaving}
                >
                  {isAvailable ? "Edit" : "Set"}
                </Button>
                {isAvailable ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-1"
                    onClick={() => handleRemove(index)}
                    disabled={isSaving}
                  >
                    ×
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {editingDay !== null ? (
        <div className="surface-soft p-4">
          <p className="text-sm font-medium text-foreground mb-3">
            Set availability for {DAYS[editingDay]}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Start</label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-32"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End</label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingDay(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
