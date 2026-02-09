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

type BookingSnapshot = {
  serviceType?: string;
  serviceDate?: string;
  serviceWindowStart?: string;
  serviceWindowEnd?: string;
  estimatedDurationMinutes?: number;
  customerName?: string;
  notes?: string;
  locationSnapshot?: {
    street?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  status: string;
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
  booking: BookingSnapshot | null;
};

type ChecklistItem = {
  _id: Id<"bookingChecklistItems">;
  bookingAssignmentId: Id<"bookingAssignments">;
  bookingId: Id<"bookings">;
  label: string;
  sortOrder: number;
  category?: string;
  isCompleted: boolean;
  completedAt?: number;
};

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
  const [notice, setNotice] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<Id<"bookingAssignments"> | null>(null);

  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const cleaner = useQuery(api.cleaners.getByEmail, email ? { email } : "skip");
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
          <View style={styles.headerRow}>
            <Text style={styles.headerName}>{cleanerName}</Text>
            <SecondaryCTA title={isSigningOut ? "Signing out..." : "Sign Out"} onPress={handleSignOut} styles={styles} />
          </View>
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
          selectedAssignmentId ? (
            <JobDetailScreen
              styles={styles}
              assignmentId={selectedAssignmentId}
              assignments={assignments ?? []}
              cleanerId={cleaner._id}
              onBack={() => setSelectedAssignmentId(null)}
              onNotice={setNotice}
            />
          ) : (
            <CleanerAssignmentsPanel
              styles={styles}
              assignments={assignments ?? []}
              onNotice={setNotice}
              onSelectAssignment={setSelectedAssignmentId}
            />
          )
        ) : null}
      </ScrollView>
    </AppFrame>
  );
}

function CleanerAssignmentsPanel({
  styles,
  assignments,
  onNotice,
  onSelectAssignment,
}: {
  styles: AppStyles;
  assignments: CleanerAssignment[];
  onNotice: (value: string | null) => void;
  onSelectAssignment: (id: Id<"bookingAssignments">) => void;
}) {
  return (
    <SurfaceCard styles={styles}>
      <Text style={styles.sectionTitle}>Assignments</Text>
      {assignments.length === 0 ? <Text style={styles.rowSubtitle}>No assignments found.</Text> : null}

      <View style={styles.listColumn}>
        {assignments
          .slice()
          .sort((a, b) => b.assignedAt - a.assignedAt)
          .map((assignment) => {
            const booking = assignment.booking;
            const serviceLabel = booking?.serviceType
              ? booking.serviceType.replace(/_/g, " ")
              : "Unknown service";
            const dateLabel = booking?.serviceDate ?? "No date";
            const timeLabel =
              booking?.serviceWindowStart && booking?.serviceWindowEnd
                ? `${booking.serviceWindowStart} - ${booking.serviceWindowEnd}`
                : "";
            const customerLabel = booking?.customerName ?? "";

            return (
              <Pressable
                key={assignment._id}
                onPress={() => onSelectAssignment(assignment._id)}
                style={styles.rowCard}
              >
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle}>{serviceLabel}</Text>
                  <MetaPill styles={styles} label={assignment.status.replace(/_/g, " ")} tone="info" />
                </View>
                <Text style={styles.rowSubtitle}>
                  {dateLabel}
                  {timeLabel ? ` \u00B7 ${timeLabel}` : ""}
                </Text>
                {customerLabel ? <Text style={styles.rowSubtitle}>{customerLabel}</Text> : null}
              </Pressable>
            );
          })}
      </View>
    </SurfaceCard>
  );
}

function JobDetailScreen({
  styles,
  assignmentId,
  assignments,
  cleanerId,
  onBack,
  onNotice,
}: {
  styles: AppStyles;
  assignmentId: Id<"bookingAssignments">;
  assignments: CleanerAssignment[];
  cleanerId: Id<"cleaners">;
  onBack: () => void;
  onNotice: (value: string | null) => void;
}) {
  const respondToAssignment = useMutation(api.cleaners.respondToAssignment);
  const confirmAssignment = useMutation(api.cleaners.confirmAssignment);
  const clockIn = useMutation(api.cleaners.clockIn);
  const clockOut = useMutation(api.cleaners.clockOut);
  const toggleChecklistItem = useMutation(api.cleaners.toggleChecklistItem);

  const checklistItems = useQuery(api.cleaners.getChecklistItems, { bookingAssignmentId: assignmentId }) as
    | ChecklistItem[]
    | undefined;

  const [savingId, setSavingId] = useState<string | null>(null);
  const [cleanerNotes, setCleanerNotes] = useState("");

  const assignment = assignments.find((a) => a._id === assignmentId);
  if (!assignment) {
    return (
      <SurfaceCard styles={styles}>
        <SecondaryCTA title="Back" onPress={onBack} styles={styles} />
        <Text style={styles.rowSubtitle}>Assignment not found.</Text>
      </SurfaceCard>
    );
  }

  const booking = assignment.booking;
  const isSaving = savingId !== null;

  const runAction = async (key: string, successMessage: string, fn: () => Promise<unknown>) => {
    setSavingId(key);
    try {
      await fn();
      onNotice(successMessage);
    } catch (error) {
      onNotice(getErrorMessage(error));
    } finally {
      setSavingId(null);
    }
  };

  const completedCount = checklistItems?.filter((i) => i.isCompleted).length ?? 0;
  const totalCount = checklistItems?.length ?? 0;
  const checklistComplete = totalCount === 0 || completedCount === totalCount;

  const locationParts = booking?.locationSnapshot
    ? [
        booking.locationSnapshot.street,
        booking.locationSnapshot.addressLine2,
        booking.locationSnapshot.city,
        booking.locationSnapshot.state,
        booking.locationSnapshot.postalCode,
      ]
        .filter(Boolean)
        .join(", ")
    : null;
  const checklistCard =
    checklistItems !== undefined && totalCount > 0 ? (
      <SurfaceCard styles={styles}>
        <View style={styles.rowTop}>
          <Text style={styles.sectionTitle}>Checklist</Text>
          <MetaPill
            styles={styles}
            label={`${completedCount}/${totalCount}`}
            tone={checklistComplete ? "success" : "info"}
          />
        </View>
        <View style={styles.listColumn}>
          {checklistItems.map((item) => (
            <Pressable
              key={item._id}
              onPress={() =>
                runAction(
                  `checklist-${item._id}`,
                  item.isCompleted ? "Item unchecked" : "Item checked",
                  () =>
                    toggleChecklistItem({
                      checklistItemId: item._id,
                      isCompleted: !item.isCompleted,
                      completedBy: !item.isCompleted ? cleanerId : undefined,
                    })
                )
              }
              style={styles.checkItem}
              disabled={isSaving}
            >
              <Text style={[styles.metaPill, item.isCompleted ? styles.metaPillSuccess : styles.metaPillInfo]}>
                {item.isCompleted ? "\u2713" : "\u25CB"}
              </Text>
              <View style={styles.checkBody}>
                <Text
                  style={[
                    styles.checkTitle,
                    item.isCompleted && { textDecorationLine: "line-through" as const, opacity: 0.6 },
                  ]}
                >
                  {item.label}
                </Text>
                {item.category ? <Text style={styles.checkDetail}>{item.category}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      </SurfaceCard>
    ) : null;

  return (
    <>
      <SurfaceCard styles={styles}>
        <SecondaryCTA title="Back to Assignments" onPress={onBack} styles={styles} />
      </SurfaceCard>

      <SurfaceCard styles={styles}>
        <Text style={styles.sectionTitle}>Job Details</Text>
        <DetailRow styles={styles} label="Service Type" value={booking?.serviceType?.replace(/_/g, " ") ?? "N/A"} />
        <DetailRow styles={styles} label="Date" value={booking?.serviceDate ?? "N/A"} />
        {booking?.serviceWindowStart && booking?.serviceWindowEnd ? (
          <DetailRow styles={styles} label="Time Window" value={`${booking.serviceWindowStart} - ${booking.serviceWindowEnd}`} />
        ) : null}
        {booking?.estimatedDurationMinutes ? (
          <DetailRow styles={styles} label="Est. Duration" value={`${booking.estimatedDurationMinutes} min`} />
        ) : null}
        {booking?.customerName ? <DetailRow styles={styles} label="Customer" value={booking.customerName} /> : null}
        {locationParts ? <DetailRow styles={styles} label="Address" value={locationParts} /> : null}
        {booking?.notes ? <DetailRow styles={styles} label="Booking Notes" value={booking.notes} /> : null}
        <DetailRow styles={styles} label="Status" value={assignment.status.replace(/_/g, " ")} />
        <DetailRow styles={styles} label="Role" value={assignment.role} />
      </SurfaceCard>
      {assignment.status === "in_progress" ? checklistCard : null}

      <SurfaceCard styles={styles}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <TextInput
          value={cleanerNotes}
          onChangeText={setCleanerNotes}
          placeholder="Cleaner notes (optional)"
          placeholderTextColor={styles.subtitle.color}
          style={styles.input}
        />
        <View style={styles.actionRow}>
          {assignment.status === "pending" ? (
            <>
              <PrimaryCTA
                title={isSaving ? "Saving..." : "Accept"}
                onPress={() =>
                  runAction("accept", "Assignment accepted", () =>
                    respondToAssignment({
                      assignmentId: assignment._id,
                      response: "accepted",
                      cleanerNotes: cleanerNotes.trim() || undefined,
                    })
                  )
                }
                styles={styles}
                disabled={isSaving}
              />
              <SecondaryCTA
                title={isSaving ? "Saving..." : "Decline"}
                onPress={() =>
                  runAction("decline", "Assignment declined", () =>
                    respondToAssignment({
                      assignmentId: assignment._id,
                      response: "declined",
                      cleanerNotes: cleanerNotes.trim() || undefined,
                    })
                  )
                }
                styles={styles}
                disabled={isSaving}
              />
            </>
          ) : null}

          {assignment.status === "accepted" ? (
            <PrimaryCTA
              title={isSaving ? "Saving..." : "Confirm"}
              onPress={() =>
                runAction("confirm", "Assignment confirmed", () =>
                  confirmAssignment({ assignmentId: assignment._id })
                )
              }
              styles={styles}
              disabled={isSaving}
            />
          ) : null}

          {assignment.status === "confirmed" ? (
            <PrimaryCTA
              title={isSaving ? "Saving..." : "Clock In"}
              onPress={() =>
                runAction("clockin", "Clocked in", () =>
                  clockIn({ assignmentId: assignment._id })
                )
              }
              styles={styles}
              disabled={isSaving}
            />
          ) : null}

          {assignment.status === "in_progress" ? (
            <PrimaryCTA
              title={isSaving ? "Saving..." : checklistComplete ? "Clock Out" : "Complete Checklist First"}
              onPress={() =>
                runAction("clockout", "Clocked out", () =>
                  clockOut({
                    assignmentId: assignment._id,
                    cleanerNotes: cleanerNotes.trim() || undefined,
                  })
                )
              }
              styles={styles}
              disabled={isSaving || !checklistComplete}
            />
          ) : null}
        </View>
        {assignment.status === "in_progress" && !checklistComplete ? (
          <Text style={styles.errorText}>
            Complete all checklist items before clocking out.
          </Text>
        ) : null}
      </SurfaceCard>
      {assignment.status !== "in_progress" ? checklistCard : null}
    </>
  );
}

function DetailRow({ styles, label, value }: { styles: AppStyles; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    headerName: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.foreground,
      flex: 1,
    },
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
    detailRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "flex-start" as const,
      gap: 12,
      paddingVertical: 4,
    },
    detailLabel: {
      fontSize: 13,
      fontWeight: "600" as const,
      color: theme.mutedForeground,
      minWidth: 100,
    },
    detailValue: {
      fontSize: 14,
      color: theme.cardForeground,
      flex: 1,
      textAlign: "right" as const,
    },
  });
}
