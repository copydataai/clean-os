"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import type { Id } from "@clean-os/convex/data-model";
import { api } from "@clean-os/convex/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Skill = {
  _id: Id<"cleanerSkills">;
  skillType: string;
  proficiencyLevel: string;
  notes?: string;
  isVerified?: boolean;
};

type SkillsManagerProps = {
  cleanerId: Id<"cleaners">;
  skills: Skill[];
};

const SKILL_OPTIONS = [
  "deep_cleaning",
  "window",
  "carpet",
  "hardwood",
  "appliances",
  "organizing",
  "laundry",
  "pet_safe",
];

const PROFICIENCY_OPTIONS = ["beginner", "intermediate", "advanced", "expert"];

export default function SkillsManager({ cleanerId, skills }: SkillsManagerProps) {
  const addSkill = useMutation(api.cleaners.addSkill);
  const updateSkill = useMutation(api.cleaners.updateSkill);
  const removeSkill = useMutation(api.cleaners.removeSkill);

  const [newSkillType, setNewSkillType] = useState(SKILL_OPTIONS[0]);
  const [newProficiency, setNewProficiency] = useState(PROFICIENCY_OPTIONS[1]);
  const [newNotes, setNewNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<Id<"cleanerSkills"> | null>(null);
  const [editProficiency, setEditProficiency] = useState(PROFICIENCY_OPTIONS[1]);
  const [editNotes, setEditNotes] = useState("");

  const existingSkills = useMemo(() => new Set(skills.map((skill) => skill.skillType)), [skills]);

  const addNewSkill = async () => {
    if (existingSkills.has(newSkillType)) return;
    setIsSaving(true);
    try {
      await addSkill({
        cleanerId,
        skillType: newSkillType,
        proficiencyLevel: newProficiency,
        notes: newNotes || undefined,
      });
      setNewNotes("");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (skill: Skill) => {
    setEditingId(skill._id);
    setEditProficiency(skill.proficiencyLevel);
    setEditNotes(skill.notes ?? "");
  };

  const saveEdit = async (skillId: Id<"cleanerSkills">) => {
    setIsSaving(true);
    try {
      await updateSkill({
        skillId,
        proficiencyLevel: editProficiency,
        notes: editNotes || undefined,
      });
      setEditingId(null);
      setEditNotes("");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSkill = async (skillId: Id<"cleanerSkills">) => {
    setIsSaving(true);
    try {
      await removeSkill({ skillId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="surface-soft p-4">
        <p className="text-sm font-medium text-foreground">Add skill</p>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Select
            value={newSkillType}
            onValueChange={(value) => setNewSkillType(value ?? SKILL_OPTIONS[0])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SKILL_OPTIONS.map((option) => (
                <SelectItem
                  key={option}
                  value={option}
                  disabled={existingSkills.has(option)}
                >
                  {option.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={newProficiency}
            onValueChange={(value) => setNewProficiency(value ?? PROFICIENCY_OPTIONS[1])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROFICIENCY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={newNotes}
            onChange={(event) => setNewNotes(event.target.value)}
            placeholder="Optional notes"
          />
          <Button disabled={isSaving || existingSkills.has(newSkillType)} onClick={addNewSkill}>
            Add Skill
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {skills.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills added yet.</p>
        ) : (
          skills.map((skill) => (
            <div key={skill._id} className="surface-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-muted text-muted-foreground">
                    {skill.skillType.replace(/_/g, " ")}
                  </Badge>
                  {skill.isVerified ? (
                    <Badge className="bg-green-100 text-green-800">verified</Badge>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(skill)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => deleteSkill(skill._id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {editingId === skill._id ? (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Select
                    value={editProficiency}
                    onValueChange={(value) =>
                      setEditProficiency(value ?? PROFICIENCY_OPTIONS[1])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROFICIENCY_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={editNotes}
                    onChange={(event) => setEditNotes(event.target.value)}
                    placeholder="Notes"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={isSaving} onClick={() => saveEdit(skill._id)}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  {skill.proficiencyLevel}
                  {skill.notes ? ` · ${skill.notes}` : ""}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
