import { api } from "@clean-os/convex/api";
import type { Id } from "@clean-os/convex/data-model";
import { ClerkProvider, useAuth, useClerk, useSSO, useSignIn, useSignUp, useUser } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { ConvexReactClient, useMutation, useQuery } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import * as AuthSession from "expo-auth-session";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { type ReactNode, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
WebBrowser.maybeCompleteAuthSession();

type AuthMode = "sign-in" | "sign-up";
type CleanerTab = "overview" | "qualifications" | "availability" | "assignments";

type ThemeTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  gradientPrimary: string;
  gradientAccent: string;
  shadowColor: string;
};

type CleanerServiceQualification = {
  _id: Id<"cleanerServiceTypes">;
  serviceType: string;
  isQualified: boolean;
  isPreferred?: boolean;
  qualifiedAt?: number;
};

type CleanerSkill = {
  _id: Id<"cleanerSkills">;
  skillType: string;
  proficiencyLevel: string;
  notes?: string;
  isVerified?: boolean;
};

type CleanerAvailability = {
  _id: Id<"cleanerAvailability">;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

type CleanerAssignment = {
  _id: Id<"bookingAssignments">;
  bookingId: Id<"bookings">;
  role: string;
  status: string;
  assignedAt: number;
  cleanerNotes?: string;
  clockedInAt?: number;
  clockedOutAt?: number;
  actualDurationMinutes?: number;
};

const REQUIRED_SERVICE_TYPES = ["standard", "deep", "move_out"] as const;
const EXTRA_SERVICE_TYPES = ["move_in", "post_construction", "airbnb"] as const;
const SKILL_OPTIONS = [
  "deep_cleaning",
  "window",
  "carpet",
  "hardwood",
  "appliances",
  "organizing",
  "laundry",
  "pet_safe",
] as const;
const PROFICIENCY_OPTIONS = ["beginner", "intermediate", "advanced", "expert"] as const;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const LIGHT_THEME: ThemeTokens = {
  background: "#f5fcfc",
  foreground: "#192b39",
  card: "#ffffff",
  cardForeground: "#192b39",
  primary: "#007fa0",
  primaryForeground: "#f8fafd",
  secondary: "#e3f1f6",
  secondaryForeground: "#233849",
  muted: "#e8f0f3",
  mutedForeground: "#5a6873",
  accent: "#d2eef1",
  destructive: "#df2225",
  border: "#d2dde2",
  input: "#d2dde2",
  ring: "#349ab6",
  gradientPrimary: "rgba(0, 127, 160, 0.22)",
  gradientAccent: "rgba(210, 238, 241, 0.34)",
  shadowColor: "rgba(12, 30, 72, 0.35)",
};

const DARK_THEME: ThemeTokens = {
  background: "#0e171f",
  foreground: "#e8f0f4",
  card: "#172029",
  cardForeground: "#e8f0f4",
  primary: "#0baec8",
  primaryForeground: "#0e171f",
  secondary: "#2a3138",
  secondaryForeground: "#e8f0f4",
  muted: "#2a3138",
  mutedForeground: "#acbac1",
  accent: "#293b40",
  destructive: "#ff6467",
  border: "rgba(255, 255, 255, 0.12)",
  input: "rgba(255, 255, 255, 0.15)",
  ring: "#0baec8",
  gradientPrimary: "rgba(11, 174, 200, 0.2)",
  gradientAccent: "rgba(41, 59, 64, 0.32)",
  shadowColor: "#000000",
};

type AppStyles = ReturnType<typeof createStyles>;

export default function App() {
  const { statusBarStyle, styles, theme } = useAppTheme();
  const convexClient = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, []);

  if (!publishableKey) {
    return (
      <AppFrame styles={styles}>
        <StatusBar style={statusBarStyle} />
        <SurfaceCard styles={styles}>
          <Text style={styles.title}>Cleaner</Text>
          <Text style={styles.subtitle}>
            Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your environment before starting the app.
          </Text>
        </SurfaceCard>
      </AppFrame>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <StatusBar style={statusBarStyle} />
      <Root styles={styles} theme={theme} convexClient={convexClient} />
    </ClerkProvider>
  );
}

function Root({
  styles,
  theme,
  convexClient,
}: {
  styles: AppStyles;
  theme: ThemeTokens;
  convexClient: ConvexReactClient | null;
}) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <AppFrame styles={styles}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </AppFrame>
    );
  }

  if (isSignedIn) {
    if (convexClient) {
      return (
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          <SignedInCleanerApp styles={styles} />
        </ConvexProviderWithClerk>
      );
    }
    return <SignedInConvexDisabled styles={styles} />;
  }

  return <AuthScreen styles={styles} theme={theme} />;
}

function SignedInConvexDisabled({ styles }: { styles: AppStyles }) {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <AppFrame styles={styles}>
      <ScrollView contentContainerStyle={styles.pageBody} showsVerticalScrollIndicator={false}>
        <SurfaceCard styles={styles}>
          <Text style={styles.sectionTitle}>Convex Setup Required</Text>
          <Text style={styles.subtitle}>
            Convex is not configured. Add EXPO_PUBLIC_CONVEX_URL to enable live cleaner validation and operational data.
          </Text>
          <PrimaryCTA title={isSigningOut ? "Signing out..." : "Sign Out"} onPress={handleSignOut} styles={styles} />
        </SurfaceCard>
      </ScrollView>
    </AppFrame>
  );
}

function SignedInCleanerApp({ styles }: { styles: AppStyles }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [activeTab, setActiveTab] = useState<CleanerTab>("overview");
  const [notice, setNotice] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const cleaner = useQuery(api.cleaners.getByEmail, email ? { email } : "skip");
  const cleanerDetails = useQuery(
    api.cleaners.getWithDetails,
    cleaner ? { cleanerId: cleaner._id } : "skip"
  );
  const assignments = useQuery(
    api.cleaners.getAssignments,
    cleaner ? { cleanerId: cleaner._id } : "skip"
  );

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  const cleanerName = cleaner
    ? `${cleaner.firstName ?? ""} ${cleaner.lastName ?? ""}`.trim() || cleaner.email
    : email ?? "Cleaner";

  return (
    <AppFrame styles={styles}>
      <ScrollView contentContainerStyle={styles.pageBody} showsVerticalScrollIndicator={false}>
        {notice ? (
          <SurfaceCard styles={styles}>
            <View style={styles.noticeRow}>
              <Text style={styles.noticeText}>{notice}</Text>
              <SecondaryCTA title="Dismiss" onPress={() => setNotice(null)} styles={styles} />
            </View>
          </SurfaceCard>
        ) : null}

        <SurfaceCard styles={styles}>
          <Text style={styles.title}>Cleaner Workspace</Text>
          <Text style={styles.subtitle}>Signed in as {email ?? "no email found"}</Text>
          <View style={styles.metaRow}>
            <MetaPill styles={styles} label={cleaner?.status ?? "status unknown"} tone="info" />
            <MetaPill styles={styles} label={cleaner?.employmentType ?? "employment unknown"} tone="neutral" />
            <MetaPill styles={styles} label={cleanerName} tone="neutral" />
          </View>
          <PrimaryCTA title={isSigningOut ? "Signing out..." : "Sign Out"} onPress={handleSignOut} styles={styles} />
        </SurfaceCard>

        {email === null ? (
          <SurfaceCard styles={styles}>
            <Text style={styles.sectionTitle}>Missing account email</Text>
            <Text style={styles.subtitle}>Clerk did not return a primary email for this user.</Text>
          </SurfaceCard>
        ) : null}

        {email !== null && cleaner === undefined ? (
          <SurfaceCard styles={styles}>
            <Text style={styles.sectionTitle}>Loading cleaner profile...</Text>
          </SurfaceCard>
        ) : null}

        {email !== null && cleaner === null ? (
          <SurfaceCard styles={styles}>
            <Text style={styles.sectionTitle}>Cleaner profile not linked</Text>
            <Text style={styles.subtitle}>
              No cleaner record was found for {email}. Create or link a cleaner profile in admin to continue.
            </Text>
          </SurfaceCard>
        ) : null}

        {cleaner ? (
          <>
            <TabBar styles={styles} activeTab={activeTab} onChange={setActiveTab} />

            {cleanerDetails === undefined ? (
              <SurfaceCard styles={styles}>
                <Text style={styles.sectionTitle}>Loading cleaner details...</Text>
              </SurfaceCard>
            ) : cleanerDetails === null ? (
              <SurfaceCard styles={styles}>
                <Text style={styles.sectionTitle}>Cleaner details unavailable</Text>
                <Text style={styles.subtitle}>
                  The cleaner profile exists but extended detail records could not be loaded.
                </Text>
              </SurfaceCard>
            ) : (
              <>
                {activeTab === "overview" ? (
                  <CleanerOverviewPanel
                    styles={styles}
                    cleaner={cleaner}
                    cleanerDetails={cleanerDetails}
                    assignments={assignments ?? []}
                  />
                ) : null}

                {activeTab === "qualifications" ? (
                  <CleanerQualificationsPanel
                    styles={styles}
                    cleanerId={cleaner._id}
                    cleanerDetails={cleanerDetails}
                    onNotice={setNotice}
                  />
                ) : null}

                {activeTab === "availability" ? (
                  <CleanerAvailabilityPanel
                    styles={styles}
                    cleanerId={cleaner._id}
                    availability={cleanerDetails.availability ?? []}
                    onNotice={setNotice}
                  />
                ) : null}

                {activeTab === "assignments" ? (
                  <CleanerAssignmentsPanel
                    styles={styles}
                    assignments={assignments ?? []}
                    onNotice={setNotice}
                  />
                ) : null}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </AppFrame>
  );
}

function CleanerOverviewPanel({
  styles,
  cleaner,
  cleanerDetails,
  assignments,
}: {
  styles: AppStyles;
  cleaner: {
    hasOwnTransportation?: boolean;
    hasOwnEquipment?: boolean;
    willingToTravel?: boolean;
  };
  cleanerDetails: {
    serviceTypes?: CleanerServiceQualification[];
    availability?: CleanerAvailability[];
    activePayRate?: { payType: string; baseRate: number; currency?: string } | null;
  };
  assignments: CleanerAssignment[];
}) {
  const serviceTypes = cleanerDetails.serviceTypes ?? [];
  const qualifiedSet = new Set(
    serviceTypes
      .filter((item) => item.isQualified)
      .map((item) => item.serviceType.toLowerCase())
  );
  const missingRequired = REQUIRED_SERVICE_TYPES.filter((serviceType) => !qualifiedSet.has(serviceType));
  const activeAvailability = (cleanerDetails.availability ?? []).filter((slot) => slot.isActive);
  const hasValidAvailability = activeAvailability.length > 0;
  const hasPayRate = Boolean(cleanerDetails.activePayRate);

  const checks = [
    {
      label: "Required service qualifications",
      valid: missingRequired.length === 0,
      detail:
        missingRequired.length === 0
          ? "All required services are qualified"
          : `Missing: ${missingRequired.join(", ")}`,
    },
    {
      label: "Availability configured",
      valid: hasValidAvailability,
      detail: hasValidAvailability
        ? `${activeAvailability.length} active day(s)`
        : "No active availability slots",
    },
    {
      label: "Active pay rate",
      valid: hasPayRate,
      detail: hasPayRate
        ? formatPayRate(
            cleanerDetails.activePayRate?.baseRate ?? 0,
            cleanerDetails.activePayRate?.payType ?? "hourly",
            cleanerDetails.activePayRate?.currency
          )
        : "Set an active pay rate",
    },
    {
      label: "Transportation",
      valid: cleaner.hasOwnTransportation === true,
      detail: cleaner.hasOwnTransportation ? "Own transportation" : "Transportation not confirmed",
    },
    {
      label: "Equipment",
      valid: cleaner.hasOwnEquipment === true,
      detail: cleaner.hasOwnEquipment ? "Own equipment" : "Equipment not confirmed",
    },
  ];

  const pendingAssignments = assignments.filter((item) => item.status === "pending").length;
  const activeAssignments = assignments.filter((item) => item.status === "in_progress").length;
  const confirmedAssignments = assignments.filter((item) => item.status === "confirmed").length;

  return (
    <>
      <SurfaceCard styles={styles}>
        <Text style={styles.sectionTitle}>Readiness Validation</Text>
        <View style={styles.checkList}>
          {checks.map((check) => (
            <View key={check.label} style={styles.checkItem}>
              <MetaPill
                styles={styles}
                label={check.valid ? "Pass" : "Action Required"}
                tone={check.valid ? "success" : "danger"}
              />
              <View style={styles.checkBody}>
                <Text style={styles.checkTitle}>{check.label}</Text>
                <Text style={styles.checkDetail}>{check.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </SurfaceCard>

      <SurfaceCard styles={styles}>
        <Text style={styles.sectionTitle}>Operational Snapshot</Text>
        <View style={styles.metricGrid}>
          <MetricCard styles={styles} label="Pending" value={String(pendingAssignments)} />
          <MetricCard styles={styles} label="Confirmed" value={String(confirmedAssignments)} />
          <MetricCard styles={styles} label="In Progress" value={String(activeAssignments)} />
          <MetricCard styles={styles} label="Total Assignments" value={String(assignments.length)} />
        </View>
      </SurfaceCard>
    </>
  );
}

function CleanerQualificationsPanel({
  styles,
  cleanerId,
  cleanerDetails,
  onNotice,
}: {
  styles: AppStyles;
  cleanerId: Id<"cleaners">;
  cleanerDetails: {
    serviceTypes?: CleanerServiceQualification[];
    skills?: CleanerSkill[];
  };
  onNotice: (value: string | null) => void;
}) {
  const addQualification = useMutation(api.cleaners.addServiceTypeQualification);
  const updateQualification = useMutation(api.cleaners.updateServiceTypeQualification);
  const removeQualification = useMutation(api.cleaners.removeServiceTypeQualification);
  const addSkill = useMutation(api.cleaners.addSkill);
  const updateSkill = useMutation(api.cleaners.updateSkill);
  const removeSkill = useMutation(api.cleaners.removeSkill);

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [selectedServiceType, setSelectedServiceType] = useState<string>(REQUIRED_SERVICE_TYPES[0]);
  const [selectedSkillType, setSelectedSkillType] = useState<string>(SKILL_OPTIONS[0]);
  const [selectedSkillProficiency, setSelectedSkillProficiency] = useState<string>(PROFICIENCY_OPTIONS[1]);
  const [skillNotes, setSkillNotes] = useState("");

  const qualifications = cleanerDetails.serviceTypes ?? [];
  const skills = cleanerDetails.skills ?? [];

  const qualificationByType = Object.fromEntries(
    qualifications.map((item) => [item.serviceType.toLowerCase(), item])
  );
  const allServiceTypes = Array.from(
    new Set([
      ...REQUIRED_SERVICE_TYPES,
      ...EXTRA_SERVICE_TYPES,
      ...qualifications.map((item) => item.serviceType.toLowerCase()),
    ])
  );

  const missingRequired = REQUIRED_SERVICE_TYPES.filter((serviceType) => {
    const qualification = qualificationByType[serviceType];
    return !qualification || !qualification.isQualified;
  });

  const existingSkills = new Set(skills.map((skill) => skill.skillType));

  const runMutation = async (key: string, fn: () => Promise<unknown>, successMessage: string) => {
    setSavingKey(key);
    try {
      await fn();
      onNotice(successMessage);
    } catch (error) {
      onNotice(getErrorMessage(error));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <>
      <SurfaceCard styles={styles}>
        <Text style={styles.sectionTitle}>Service Qualification Validation</Text>
        {missingRequired.length > 0 ? (
          <Text style={styles.validationError}>Missing required types: {missingRequired.join(", ")}</Text>
        ) : (
          <Text style={styles.validationSuccess}>All required service types are covered.</Text>
        )}

        <Text style={styles.blockLabel}>Quick add qualification</Text>
        <OptionGrid
          styles={styles}
          options={allServiceTypes}
          selected={selectedServiceType}
          onSelect={setSelectedServiceType}
          disabledLookup={qualificationByType}
        />

        <PrimaryCTA
          title={savingKey === "qualification-add" ? "Saving..." : "Add Qualification"}
          onPress={() =>
            runMutation(
              "qualification-add",
              () =>
                addQualification({
                  cleanerId,
                  serviceType: selectedServiceType,
                  isQualified: true,
                  isPreferred: false,
                  qualifiedAt: Date.now(),
                }),
              "Qualification added"
            )
          }
          styles={styles}
          disabled={Boolean(qualificationByType[selectedServiceType]) || savingKey !== null}
        />
      </SurfaceCard>

      <SurfaceCard styles={styles}>
        <Text style={styles.sectionTitle}>Service Types</Text>
        <View style={styles.listColumn}>
          {allServiceTypes.map((serviceType) => {
            const qualification = qualificationByType[serviceType];

            return (
              <View key={serviceType} style={styles.rowCard}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle}>{serviceType}</Text>
                  {qualification?.isPreferred ? (
                    <MetaPill styles={styles} label="preferred" tone="info" />
                  ) : null}
                </View>
                <Text style={styles.rowSubtitle}>
                  {qualification
                    ? qualification.isQualified
                      ? "Qualified"
                      : "Not qualified"
                    : "Not configured"}
                </Text>

                <View style={styles.actionRow}>
                  {qualification ? (
                    <SecondaryCTA
                      title={qualification.isQualified ? "Unqualify" : "Qualify"}
                      onPress={() =>
                        runMutation(
                          `qualify-${qualification._id}`,
                          () =>
                            updateQualification({
                              qualificationId: qualification._id,
                              isQualified: !qualification.isQualified,
                              qualifiedAt: !qualification.isQualified ? Date.now() : undefined,
                            }),
                          "Qualification updated"
                        )
                      }
                      styles={styles}
                      disabled={savingKey !== null}
                    />
                  ) : (
                    <SecondaryCTA
                      title="Create"
                      onPress={() =>
                        runMutation(
                          `create-${serviceType}`,
                          () =>
                            addQualification({
                              cleanerId,
                              serviceType,
                              isQualified: true,
                              isPreferred: false,
                              qualifiedAt: Date.now(),
                            }),
                          "Qualification created"
                        )
                      }
                      styles={styles}
                      disabled={savingKey !== null}
                    />
                  )}

                  {qualification ? (
                    <SecondaryCTA
                      title={qualification.isPreferred ? "Unset preferred" : "Set preferred"}
                      onPress={() =>
                        runMutation(
                          `preferred-${qualification._id}`,
                          () =>
                            updateQualification({
                              qualificationId: qualification._id,
                              isPreferred: !qualification.isPreferred,
                            }),
                          "Preference updated"
                        )
                      }
                      styles={styles}
                      disabled={savingKey !== null}
                    />
                  ) : null}

                  {qualification ? (
                    <SecondaryCTA
                      title="Remove"
                      onPress={() =>
                        runMutation(
                          `remove-${qualification._id}`,
                          () => removeQualification({ qualificationId: qualification._id }),
                          "Qualification removed"
                        )
                      }
                      styles={styles}
                      disabled={savingKey !== null}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </SurfaceCard>

      <SurfaceCard styles={styles}>
        <Text style={styles.sectionTitle}>Skills</Text>
        <Text style={styles.blockLabel}>Skill type</Text>
        <OptionGrid
          styles={styles}
          options={[...SKILL_OPTIONS]}
          selected={selectedSkillType}
          onSelect={setSelectedSkillType}
          disabledLookup={Object.fromEntries([...existingSkills].map((skill) => [skill, true]))}
        />

        <Text style={styles.blockLabel}>Proficiency</Text>
        <OptionGrid
          styles={styles}
          options={[...PROFICIENCY_OPTIONS]}
          selected={selectedSkillProficiency}
          onSelect={setSelectedSkillProficiency}
        />

        <TextInput
          value={skillNotes}
          onChangeText={setSkillNotes}
          placeholder="Optional skill notes"
          placeholderTextColor={styles.subtitle.color}
          style={styles.input}
        />

        <PrimaryCTA
          title={savingKey === "skill-add" ? "Saving..." : "Add Skill"}
          onPress={() =>
            runMutation(
              "skill-add",
              () =>
                addSkill({
                  cleanerId,
                  skillType: selectedSkillType,
                  proficiencyLevel: selectedSkillProficiency,
                  notes: skillNotes.trim() || undefined,
                }),
              "Skill added"
            )
          }
          styles={styles}
          disabled={existingSkills.has(selectedSkillType) || savingKey !== null}
        />

        <View style={styles.listColumn}>
          {skills.map((skill) => (
            <View key={skill._id} style={styles.rowCard}>
              <View style={styles.rowTop}>
                <Text style={styles.rowTitle}>{skill.skillType}</Text>
                {skill.isVerified ? <MetaPill styles={styles} label="verified" tone="success" /> : null}
              </View>
              <Text style={styles.rowSubtitle}>
                {skill.proficiencyLevel}
                {skill.notes ? ` - ${skill.notes}` : ""}
              </Text>
              <View style={styles.actionRow}>
                {PROFICIENCY_OPTIONS.map((level) => (
                  <Pressable
                    key={`${skill._id}-${level}`}
                    onPress={() =>
                      runMutation(
                        `skill-${skill._id}-${level}`,
                        () => updateSkill({ skillId: skill._id, proficiencyLevel: level }),
                        `Skill updated to ${level}`
                      )
                    }
                    style={[
                      styles.optionChip,
                      skill.proficiencyLevel === level && styles.optionChipActive,
                      savingKey !== null && styles.optionChipDisabled,
                    ]}
                    disabled={savingKey !== null}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        skill.proficiencyLevel === level && styles.optionChipTextActive,
                      ]}
                    >
                      {level}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <SecondaryCTA
                title="Remove Skill"
                onPress={() =>
                  runMutation(
                    `skill-remove-${skill._id}`,
                    () => removeSkill({ skillId: skill._id }),
                    "Skill removed"
                  )
                }
                styles={styles}
                disabled={savingKey !== null}
              />
            </View>
          ))}
          {skills.length === 0 ? <Text style={styles.rowSubtitle}>No skills added yet.</Text> : null}
        </View>
      </SurfaceCard>
    </>
  );
}

function CleanerAvailabilityPanel({
  styles,
  cleanerId,
  availability,
  onNotice,
}: {
  styles: AppStyles;
  cleanerId: Id<"cleaners">;
  availability: CleanerAvailability[];
  onNotice: (value: string | null) => void;
}) {
  const setAvailability = useMutation(api.cleaners.setAvailability);
  const removeAvailability = useMutation(api.cleaners.removeAvailability);

  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [isSaving, setIsSaving] = useState(false);

  const availabilityByDay = Object.fromEntries(
    availability.filter((slot) => slot.isActive).map((slot) => [slot.dayOfWeek, slot])
  ) as Record<number, CleanerAvailability>;

  const openEditor = (dayIndex: number) => {
    const slot = availabilityByDay[dayIndex];
    setEditingDay(dayIndex);
    setStartTime(slot?.startTime ?? "09:00");
    setEndTime(slot?.endTime ?? "17:00");
  };

  const saveDay = async () => {
    if (editingDay === null) return;
    if (startTime >= endTime) {
      onNotice("Start time must be before end time.");
      return;
    }

    setIsSaving(true);
    try {
      await setAvailability({
        cleanerId,
        dayOfWeek: editingDay,
        startTime,
        endTime,
      });
      onNotice(`Availability updated for ${DAYS[editingDay]}`);
      setEditingDay(null);
    } catch (error) {
      onNotice(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const removeDay = async (dayIndex: number) => {
    const slot = availabilityByDay[dayIndex];
    if (!slot) return;
    setIsSaving(true);
    try {
      await removeAvailability({ availabilityId: slot._id });
      onNotice(`Availability removed for ${DAYS[dayIndex]}`);
    } catch (error) {
      onNotice(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const activeCount = Object.values(availabilityByDay).length;

  return (
    <>
      <SurfaceCard styles={styles}>
        <Text style={styles.sectionTitle}>Availability Validation</Text>
        {activeCount > 0 ? (
          <Text style={styles.validationSuccess}>{activeCount} active day(s) configured.</Text>
        ) : (
          <Text style={styles.validationError}>No active availability. Set at least one working day.</Text>
        )}
      </SurfaceCard>

      <SurfaceCard styles={styles}>
        <Text style={styles.sectionTitle}>Weekly Availability</Text>
        <View style={styles.availabilityGrid}>
          {DAYS.map((dayLabel, index) => {
            const slot = availabilityByDay[index];
            return (
              <View key={dayLabel} style={styles.dayCard}>
                <Text style={styles.dayTitle}>{dayLabel}</Text>
                <Text style={styles.dayTime}>{slot ? `${slot.startTime} - ${slot.endTime}` : "Off"}</Text>
                <View style={styles.actionRow}>
                  <SecondaryCTA
                    title={slot ? "Edit" : "Set"}
                    onPress={() => openEditor(index)}
                    styles={styles}
                    disabled={isSaving}
                  />
                  {slot ? (
                    <SecondaryCTA
                      title="Clear"
                      onPress={() => removeDay(index)}
                      styles={styles}
                      disabled={isSaving}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </SurfaceCard>

      {editingDay !== null ? (
        <SurfaceCard styles={styles}>
          <Text style={styles.sectionTitle}>Set {DAYS[editingDay]} Hours</Text>
          <View style={styles.editorRow}>
            <View style={styles.timeInputGroup}>
              <Text style={styles.blockLabel}>Start</Text>
              <TextInput
                value={startTime}
                onChangeText={setStartTime}
                style={styles.input}
                placeholder="09:00"
                placeholderTextColor={styles.subtitle.color}
              />
            </View>
            <View style={styles.timeInputGroup}>
              <Text style={styles.blockLabel}>End</Text>
              <TextInput
                value={endTime}
                onChangeText={setEndTime}
                style={styles.input}
                placeholder="17:00"
                placeholderTextColor={styles.subtitle.color}
              />
            </View>
          </View>
          <View style={styles.actionRow}>
            <PrimaryCTA
              title={isSaving ? "Saving..." : "Save Availability"}
              onPress={saveDay}
              styles={styles}
              disabled={isSaving}
            />
            <SecondaryCTA
              title="Cancel"
              onPress={() => setEditingDay(null)}
              styles={styles}
              disabled={isSaving}
            />
          </View>
        </SurfaceCard>
      ) : null}
    </>
  );
}

function CleanerAssignmentsPanel({
  styles,
  assignments,
  onNotice,
}: {
  styles: AppStyles;
  assignments: CleanerAssignment[];
  onNotice: (value: string | null) => void;
}) {
  const respondToAssignment = useMutation(api.cleaners.respondToAssignment);
  const confirmAssignment = useMutation(api.cleaners.confirmAssignment);
  const clockIn = useMutation(api.cleaners.clockIn);
  const clockOut = useMutation(api.cleaners.clockOut);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesByAssignment, setNotesByAssignment] = useState<Record<string, string>>({});

  const runAction = async (
    assignmentId: Id<"bookingAssignments">,
    successMessage: string,
    fn: () => Promise<unknown>
  ) => {
    setSavingId(assignmentId);
    try {
      await fn();
      onNotice(successMessage);
    } catch (error) {
      onNotice(getErrorMessage(error));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <SurfaceCard styles={styles}>
      <Text style={styles.sectionTitle}>Assignment Validation</Text>
      {assignments.length === 0 ? <Text style={styles.rowSubtitle}>No assignments found.</Text> : null}

      <View style={styles.listColumn}>
        {assignments
          .slice()
          .sort((a, b) => b.assignedAt - a.assignedAt)
          .map((assignment) => {
            const note = notesByAssignment[assignment._id] ?? "";
            const isSaving = savingId === assignment._id;

            return (
              <View key={assignment._id} style={styles.rowCard}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle}>Booking {String(assignment.bookingId).slice(-6)}</Text>
                  <MetaPill styles={styles} label={assignment.status.replace(/_/g, " ")} tone="info" />
                </View>
                <Text style={styles.rowSubtitle}>
                  Assigned {new Date(assignment.assignedAt).toLocaleDateString()} - role {assignment.role}
                </Text>
                <TextInput
                  value={note}
                  onChangeText={(value) =>
                    setNotesByAssignment((prev) => ({
                      ...prev,
                      [assignment._id]: value,
                    }))
                  }
                  placeholder="Cleaner notes (optional)"
                  placeholderTextColor={styles.subtitle.color}
                  style={styles.input}
                />

                <View style={styles.actionRow}>
                  {assignment.status === "pending" ? (
                    <>
                      <SecondaryCTA
                        title={isSaving ? "Saving..." : "Accept"}
                        onPress={() =>
                          runAction(assignment._id, "Assignment accepted", () =>
                            respondToAssignment({
                              assignmentId: assignment._id,
                              response: "accepted",
                              cleanerNotes: note.trim() || undefined,
                            })
                          )
                        }
                        styles={styles}
                        disabled={isSaving}
                      />
                      <SecondaryCTA
                        title={isSaving ? "Saving..." : "Decline"}
                        onPress={() =>
                          runAction(assignment._id, "Assignment declined", () =>
                            respondToAssignment({
                              assignmentId: assignment._id,
                              response: "declined",
                              cleanerNotes: note.trim() || undefined,
                            })
                          )
                        }
                        styles={styles}
                        disabled={isSaving}
                      />
                    </>
                  ) : null}

                  {assignment.status === "accepted" ? (
                    <SecondaryCTA
                      title={isSaving ? "Saving..." : "Confirm"}
                      onPress={() =>
                        runAction(assignment._id, "Assignment confirmed", () =>
                          confirmAssignment({ assignmentId: assignment._id })
                        )
                      }
                      styles={styles}
                      disabled={isSaving}
                    />
                  ) : null}

                  {assignment.status === "confirmed" ? (
                    <SecondaryCTA
                      title={isSaving ? "Saving..." : "Clock In"}
                      onPress={() =>
                        runAction(assignment._id, "Clocked in", () =>
                          clockIn({ assignmentId: assignment._id })
                        )
                      }
                      styles={styles}
                      disabled={isSaving}
                    />
                  ) : null}

                  {assignment.status === "in_progress" ? (
                    <SecondaryCTA
                      title={isSaving ? "Saving..." : "Clock Out"}
                      onPress={() =>
                        runAction(assignment._id, "Clocked out", () =>
                          clockOut({
                            assignmentId: assignment._id,
                            cleanerNotes: note.trim() || undefined,
                          })
                        )
                      }
                      styles={styles}
                      disabled={isSaving}
                    />
                  ) : null}
                </View>
              </View>
            );
          })}
      </View>
    </SurfaceCard>
  );
}

function TabBar({
  styles,
  activeTab,
  onChange,
}: {
  styles: AppStyles;
  activeTab: CleanerTab;
  onChange: (tab: CleanerTab) => void;
}) {
  const tabs: Array<{ value: CleanerTab; label: string }> = [
    { value: "overview", label: "Overview" },
    { value: "qualifications", label: "Qualifications" },
    { value: "availability", label: "Availability" },
    { value: "assignments", label: "Assignments" },
  ];

  return (
    <SurfaceCard styles={styles}>
      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={[styles.tabButton, activeTab === tab.value && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === tab.value && styles.tabButtonTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SurfaceCard>
  );
}

function OptionGrid({
  styles,
  options,
  selected,
  onSelect,
  disabledLookup,
}: {
  styles: AppStyles;
  options: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
  disabledLookup?: Record<string, unknown>;
}) {
  return (
    <View style={styles.optionWrap}>
      {options.map((option) => {
        const disabled = Boolean(disabledLookup?.[option]);
        const isActive = selected === option;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            style={[
              styles.optionChip,
              isActive && styles.optionChipActive,
              disabled && styles.optionChipDisabled,
            ]}
            disabled={disabled}
          >
            <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MetricCard({ styles, label, value }: { styles: AppStyles; label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function MetaPill({
  styles,
  label,
  tone,
}: {
  styles: AppStyles;
  label: string;
  tone: "neutral" | "success" | "danger" | "info";
}) {
  return (
    <Text
      style={[
        styles.metaPill,
        tone === "success" && styles.metaPillSuccess,
        tone === "danger" && styles.metaPillDanger,
        tone === "info" && styles.metaPillInfo,
      ]}
    >
      {label}
    </Text>
  );
}

function AuthScreen({ styles, theme }: { styles: AppStyles; theme: ThemeTokens }) {
  const [mode, setMode] = useState<AuthMode>("sign-in");

  return (
    <AppFrame styles={styles}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Cleaner</Text>
            <Text style={styles.subtitle}>A real-time cleaner operations app using Expo + Clerk + Convex.</Text>
          </View>

          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => setMode("sign-in")}
              style={[styles.toggleButton, mode === "sign-in" && styles.toggleButtonActive]}
            >
              <Text style={[styles.toggleText, mode === "sign-in" && styles.toggleTextActive]}>Sign In</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("sign-up")}
              style={[styles.toggleButton, mode === "sign-up" && styles.toggleButtonActive]}
            >
              <Text style={[styles.toggleText, mode === "sign-up" && styles.toggleTextActive]}>Create Account</Text>
            </Pressable>
          </View>

          <GoogleSignInButton styles={styles} />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with email</Text>
            <View style={styles.dividerLine} />
          </View>

          {mode === "sign-in" ? <SignInForm styles={styles} theme={theme} /> : <SignUpForm styles={styles} theme={theme} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppFrame>
  );
}

function GoogleSignInButton({ styles }: { styles: AppStyles }) {
  const { startSSOFlow } = useSSO();
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri({ scheme: "cleaner" }),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        return;
      }

      setErrorMessage("Google sign-in was not completed.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.socialSection}>
      <Pressable onPress={handleGoogleSignIn} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>{isSubmitting ? "Connecting..." : "Continue with Google"}</Text>
      </Pressable>
      {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
    </View>
  );
}

function SignInForm({ styles, theme }: { styles: AppStyles; theme: ThemeTokens }) {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (!isLoaded || isSubmitting) return;
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const attempt = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
      } else {
        setErrorMessage("Sign-in needs another authentication step.");
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.formTitle}>Welcome back</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="name@example.com"
        placeholderTextColor={theme.mutedForeground}
        style={styles.input}
        value={email}
      />
      <TextInput
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={theme.mutedForeground}
        secureTextEntry
        style={styles.input}
        value={password}
      />
      {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
      <PrimaryCTA title={isSubmitting ? "Signing in..." : "Sign In"} onPress={handleSignIn} styles={styles} />
    </View>
  );
}

function SignUpForm({ styles, theme }: { styles: AppStyles; theme: ThemeTokens }) {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStartSignUp = async () => {
    if (!isLoaded || isSubmitting) return;
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || isSubmitting) return;
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const completed = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });

      if (completed.status === "complete") {
        await setActive({ session: completed.createdSessionId });
      } else {
        setErrorMessage("Verification is not complete yet.");
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.formTitle}>Create your account</Text>
      {!pendingVerification ? (
        <>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="name@example.com"
            placeholderTextColor={theme.mutedForeground}
            style={styles.input}
            value={email}
          />
          <TextInput
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={theme.mutedForeground}
            secureTextEntry
            style={styles.input}
            value={password}
          />
          {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
          <PrimaryCTA
            title={isSubmitting ? "Creating account..." : "Create Account"}
            onPress={handleStartSignUp}
            styles={styles}
          />
        </>
      ) : (
        <>
          <Text style={styles.verificationText}>Enter the verification code sent to {email.trim()}.</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setCode}
            placeholder="Verification code"
            placeholderTextColor={theme.mutedForeground}
            style={styles.input}
            value={code}
          />
          {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
          <PrimaryCTA title={isSubmitting ? "Verifying..." : "Verify Email"} onPress={handleVerify} styles={styles} />
        </>
      )}
    </View>
  );
}

function AppFrame({ children, styles }: { children: ReactNode; styles: AppStyles }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View pointerEvents="none" style={styles.bgOrbPrimary} />
      <View pointerEvents="none" style={styles.bgOrbAccent} />
      {children}
    </SafeAreaView>
  );
}

function SurfaceCard({ children, styles }: { children: ReactNode; styles: AppStyles }) {
  return <View style={styles.surfaceCard}>{children}</View>;
}

function PrimaryCTA({
  styles,
  title,
  onPress,
  disabled,
}: {
  styles: AppStyles;
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]} disabled={disabled}>
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function SecondaryCTA({
  styles,
  title,
  onPress,
  disabled,
}: {
  styles: AppStyles;
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.secondaryButtonSmall, disabled && styles.secondaryButtonDisabled]}
      disabled={disabled}
    >
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function useAppTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const theme = isDark ? DARK_THEME : LIGHT_THEME;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const statusBarStyle: "light" | "dark" = isDark ? "light" : "dark";

  return { theme, styles, statusBarStyle };
}

function formatPayRate(baseRate: number, payType: string, currency = "USD") {
  const normalizedType = payType.toLowerCase();
  if (normalizedType === "commission") {
    return `${baseRate}%`;
  }

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(baseRate / 100);

  if (normalizedType === "hourly") return `${money}/hr`;
  if (normalizedType === "per_job") return `${money}/job`;
  return money;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "errors" in error) {
    const errors = (error as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    const first = errors?.[0];
    if (first?.longMessage) return first.longMessage;
    if (first?.message) return first.message;
  }

  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    flex: { flex: 1 },
    screen: {
      flex: 1,
      backgroundColor: theme.background,
      overflow: "hidden",
    },
    bgOrbPrimary: {
      position: "absolute",
      width: 420,
      height: 260,
      left: -120,
      top: -100,
      borderRadius: 260,
      backgroundColor: theme.gradientPrimary,
    },
    bgOrbAccent: {
      position: "absolute",
      width: 420,
      height: 260,
      right: -110,
      top: -120,
      borderRadius: 260,
      backgroundColor: theme.gradientAccent,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    pageBody: {
      paddingHorizontal: 20,
      paddingTop: 30,
      paddingBottom: 30,
      gap: 12,
    },
    scrollBody: {
      paddingHorizontal: 20,
      paddingTop: 36,
      paddingBottom: 28,
      gap: 20,
    },
    surfaceCard: {
      padding: 18,
      borderRadius: 16,
      gap: 12,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.24,
      shadowRadius: 14,
      elevation: 2,
    },
    header: { gap: 8 },
    title: {
      fontSize: 30,
      fontWeight: "700",
      color: theme.foreground,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.mutedForeground,
    },
    sectionTitle: {
      fontSize: 19,
      fontWeight: "700",
      color: theme.cardForeground,
    },
    blockLabel: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.7,
      color: theme.mutedForeground,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    metaPill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
      color: theme.secondaryForeground,
      paddingHorizontal: 9,
      paddingVertical: 4,
      fontSize: 12,
      fontWeight: "700",
      overflow: "hidden",
    },
    metaPillSuccess: {
      backgroundColor: theme.accent,
      borderColor: theme.ring,
      color: theme.secondaryForeground,
    },
    metaPillDanger: {
      backgroundColor: "rgba(223, 34, 37, 0.12)",
      borderColor: theme.destructive,
      color: theme.destructive,
    },
    metaPillInfo: {
      backgroundColor: theme.secondary,
      borderColor: theme.ring,
      color: theme.secondaryForeground,
    },
    noticeRow: {
      gap: 10,
    },
    noticeText: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.secondaryForeground,
      fontWeight: "600",
    },
    tabRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    tabButton: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    tabButtonActive: {
      borderColor: theme.ring,
      backgroundColor: theme.secondary,
    },
    tabButtonText: {
      color: theme.mutedForeground,
      fontWeight: "700",
      fontSize: 13,
    },
    tabButtonTextActive: {
      color: theme.secondaryForeground,
    },
    checkList: {
      gap: 10,
    },
    checkItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
      padding: 10,
    },
    checkBody: {
      flex: 1,
      gap: 3,
    },
    checkTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.cardForeground,
    },
    checkDetail: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.mutedForeground,
    },
    metricGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    metricCard: {
      minWidth: 120,
      flexGrow: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
      padding: 12,
      gap: 4,
    },
    metricValue: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.cardForeground,
    },
    metricLabel: {
      fontSize: 12,
      color: theme.mutedForeground,
    },
    validationSuccess: {
      color: theme.primary,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
    },
    validationError: {
      color: theme.destructive,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
    },
    optionWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    optionChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    optionChipActive: {
      borderColor: theme.ring,
      backgroundColor: theme.secondary,
    },
    optionChipDisabled: {
      opacity: 0.45,
    },
    optionChipText: {
      color: theme.mutedForeground,
      fontSize: 12,
      fontWeight: "700",
    },
    optionChipTextActive: {
      color: theme.secondaryForeground,
    },
    listColumn: {
      gap: 10,
    },
    rowCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
      padding: 12,
      gap: 8,
    },
    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    rowTitle: {
      color: theme.cardForeground,
      fontSize: 15,
      fontWeight: "700",
      flex: 1,
    },
    rowSubtitle: {
      color: theme.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      alignItems: "center",
    },
    availabilityGrid: {
      gap: 10,
    },
    dayCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
      padding: 12,
      gap: 8,
    },
    dayTitle: {
      color: theme.cardForeground,
      fontSize: 14,
      fontWeight: "700",
    },
    dayTime: {
      color: theme.mutedForeground,
      fontSize: 13,
    },
    editorRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      alignItems: "flex-end",
    },
    timeInputGroup: {
      minWidth: 140,
      flexGrow: 1,
      gap: 6,
    },
    socialSection: {
      gap: 10,
    },
    secondaryButton: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.secondary,
      paddingVertical: 12,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    toggleRow: {
      flexDirection: "row",
      backgroundColor: theme.muted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 4,
      gap: 6,
    },
    toggleButton: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    toggleButtonActive: {
      backgroundColor: theme.card,
    },
    toggleText: {
      color: theme.mutedForeground,
      fontWeight: "600",
    },
    toggleTextActive: {
      color: theme.secondaryForeground,
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.border,
    },
    dividerText: {
      color: theme.mutedForeground,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
      gap: 12,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.24,
      shadowRadius: 14,
      elevation: 2,
    },
    formTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.cardForeground,
    },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.input,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.cardForeground,
      fontSize: 16,
      backgroundColor: theme.muted,
    },
    primaryButton: {
      marginTop: 6,
      borderRadius: 12,
      backgroundColor: theme.primary,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 120,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: theme.primaryForeground,
      fontSize: 16,
      fontWeight: "600",
    },
    secondaryButtonSmall: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.secondary,
      paddingVertical: 9,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 90,
    },
    secondaryButtonDisabled: {
      opacity: 0.55,
    },
    secondaryButtonText: {
      color: theme.secondaryForeground,
      fontSize: 14,
      fontWeight: "600",
    },
    errorText: {
      color: theme.destructive,
      fontSize: 14,
    },
    verificationText: {
      color: theme.mutedForeground,
      fontSize: 14,
      lineHeight: 20,
    },
  });
}
