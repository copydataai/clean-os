"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REQUIRED_SERVICE_TYPES } from "@/lib/cleanerInsights";

type ServiceQualification = {
  _id: Id<"cleanerServiceTypes">;
  serviceType: string;
  isQualified: boolean;
  isPreferred?: boolean;
  qualifiedAt?: number;
};

type ServiceQualificationsManagerProps = {
  cleanerId: Id<"cleaners">;
  qualifications: ServiceQualification[];
};

const EXTRA_SERVICE_TYPES = ["move_in", "post_construction", "airbnb"];

function formatDate(timestamp?: number): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString();
}

export default function ServiceQualificationsManager({
  cleanerId,
  qualifications,
}: ServiceQualificationsManagerProps) {
  const addQualification = useMutation(api.cleaners.addServiceTypeQualification);
  const updateQualification = useMutation(api.cleaners.updateServiceTypeQualification);
  const removeQualification = useMutation(api.cleaners.removeServiceTypeQualification);
  const [newServiceType, setNewServiceType] = useState(REQUIRED_SERVICE_TYPES[0]);
  const [isSaving, setIsSaving] = useState(false);

  const availableServiceTypes = useMemo(
    () => [...REQUIRED_SERVICE_TYPES, ...EXTRA_SERVICE_TYPES],
    []
  );
  const qualificationByType = useMemo(
    () =>
      Object.fromEntries(
        qualifications.map((qualification) => [
          qualification.serviceType.toLowerCase(),
          qualification,
        ])
      ),
    [qualifications]
  );
  const missingRequired = REQUIRED_SERVICE_TYPES.filter(
    (serviceType) => !qualificationByType[serviceType]?.isQualified
  );

  const addNewQualification = async () => {
    if (qualificationByType[newServiceType]) return;
    setIsSaving(true);
    try {
      await addQualification({
        cleanerId,
        serviceType: newServiceType,
        isQualified: true,
        isPreferred: false,
        qualifiedAt: Date.now(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleQualified = async (qualification: ServiceQualification) => {
    setIsSaving(true);
    try {
      await updateQualification({
        qualificationId: qualification._id,
        isQualified: !qualification.isQualified,
        qualifiedAt: !qualification.isQualified ? Date.now() : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePreferred = async (qualification: ServiceQualification) => {
    setIsSaving(true);
    try {
      await updateQualification({
        qualificationId: qualification._id,
        isPreferred: !qualification.isPreferred,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteQualification = async (qualificationId: Id<"cleanerServiceTypes">) => {
    setIsSaving(true);
    try {
      await removeQualification({ qualificationId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="service-qualifications" className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {missingRequired.length > 0 ? (
          missingRequired.map((serviceType) => (
            <Badge key={serviceType} className="bg-amber-100 text-amber-800">
              Missing: {serviceType}
            </Badge>
          ))
        ) : (
          <Badge className="bg-green-100 text-green-800">
            All required qualifications covered
          </Badge>
        )}
      </div>

      <div className="surface-soft p-4">
        <p className="text-sm font-medium text-foreground">Add service qualification</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Select value={newServiceType} onValueChange={setNewServiceType}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableServiceTypes.map((serviceType) => (
                <SelectItem
                  key={serviceType}
                  value={serviceType}
                  disabled={Boolean(qualificationByType[serviceType])}
                >
                  {serviceType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={addNewQualification}
            disabled={isSaving || Boolean(qualificationByType[newServiceType])}
          >
            Add Qualification
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {qualifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No service qualifications set.</p>
        ) : (
          qualifications.map((qualification) => (
            <div key={qualification._id} className="surface-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {qualification.serviceType}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Qualified at: {formatDate(qualification.qualifiedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => toggleQualified(qualification)}
                  >
                    {qualification.isQualified ? "Unqualify" : "Qualify"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => togglePreferred(qualification)}
                  >
                    {qualification.isPreferred ? "Unset preferred" : "Set preferred"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => deleteQualification(qualification._id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Badge
                  className={
                    qualification.isQualified
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-700"
                  }
                >
                  {qualification.isQualified ? "Qualified" : "Not qualified"}
                </Badge>
                {qualification.isPreferred ? (
                  <Badge className="bg-blue-100 text-blue-800">Preferred</Badge>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
