import { ClerkProvider, useAuth, useClerk, useSSO, useSignIn, useSignUp, useUser } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import * as AuthSession from "expo-auth-session";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { type ReactNode, useMemo, useReducer, useState } from "react";
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
WebBrowser.maybeCompleteAuthSession();

type AuthMode = "sign-in" | "sign-up";
type AppRoute =
  | "home"
  | "job:list"
  | "job:details"
  | "job:complete"
  | "checklist:template"
  | "checklist:run"
  | "checklist:submit"
  | "record:entry"
  | "record:review"
  | "record:saved";

type MockJob = {
  id: string;
  address: string;
  time: string;
  status: string;
  service: string;
  duration: string;
  contactNote: string;
};

type MockChecklistTemplate = {
  id: string;
  name: string;
  rooms: number;
  duration: string;
  highlight: string;
};

type MockRecordDraft = {
  notes: string;
  photoCount: number;
};

type AppState = {
  route: AppRoute;
  selectedJobId: string | null;
  selectedTemplateId: string | null;
  checklistCheckedIds: string[];
  recordDraft: MockRecordDraft;
  toast: string | null;
};

type AppAction =
  | { type: "OPEN_FLOW"; flow: "job" | "checklist" | "record" }
  | { type: "BACK" }
  | { type: "JOB_OPEN"; jobId: string }
  | { type: "JOB_START" }
  | { type: "JOB_COMPLETE" }
  | { type: "CHECKLIST_SELECT_TEMPLATE"; templateId: string }
  | { type: "CHECKLIST_TOGGLE_ITEM"; itemId: string }
  | { type: "CHECKLIST_REVIEW" }
  | { type: "CHECKLIST_SUBMIT" }
  | { type: "RECORD_UPDATE_NOTES"; notes: string }
  | { type: "RECORD_SET_PHOTO_COUNT"; photoCount: number }
  | { type: "RECORD_CONTINUE" }
  | { type: "RECORD_SAVE" }
  | { type: "RECORD_DONE" }
  | { type: "DISMISS_TOAST" };

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

const MOCK_JOBS: MockJob[] = [
  {
    id: "job-1",
    address: "1024 Pine Street",
    time: "9:00 AM",
    status: "Assigned",
    service: "Standard Clean",
    duration: "2h 00m",
    contactNote: "Customer prefers non-scented products.",
  },
  {
    id: "job-2",
    address: "88 Harbor Lane",
    time: "11:30 AM",
    status: "Scheduled",
    service: "Deep Clean",
    duration: "3h 30m",
    contactNote: "Ring bell at side entrance.",
  },
  {
    id: "job-3",
    address: "451 Maple Avenue",
    time: "2:15 PM",
    status: "Priority",
    service: "Move-Out",
    duration: "4h 00m",
    contactNote: "Take before/after photos of kitchen and bath.",
  },
];

const MOCK_TEMPLATES: MockChecklistTemplate[] = [
  {
    id: "template-standard",
    name: "Standard Clean",
    rooms: 5,
    duration: "45 min",
    highlight: "Weekly maintenance with essential tasks.",
  },
  {
    id: "template-deep",
    name: "Deep Clean",
    rooms: 7,
    duration: "75 min",
    highlight: "Detailed pass with baseboards and high-touch surfaces.",
  },
  {
    id: "template-move",
    name: "Move-Out",
    rooms: 9,
    duration: "95 min",
    highlight: "Turnover-ready checklist with appliance detailing.",
  },
];

const CHECKLIST_ITEMS = [
  { id: "kitchen", label: "Kitchen sanitized and counters polished" },
  { id: "bathroom", label: "Bathroom surfaces disinfected" },
  { id: "floors", label: "Floors vacuumed and mopped" },
  { id: "trash", label: "Trash removed and liners replaced" },
];

const INITIAL_APP_STATE: AppState = {
  route: "home",
  selectedJobId: null,
  selectedTemplateId: null,
  checklistCheckedIds: [],
  recordDraft: {
    notes: "",
    photoCount: 2,
  },
  toast: null,
};

type AppStyles = ReturnType<typeof createStyles>;

export default function App() {
  const { statusBarStyle, styles, theme } = useAppTheme();

  if (!publishableKey) {
    return (
      <AppFrame styles={styles}>
        <StatusBar style={statusBarStyle} />
        <View style={styles.missingKeyContainer}>
          <Text style={styles.title}>Cleaner</Text>
          <Text style={styles.subtitle}>
            Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your environment before starting the app.
          </Text>
        </View>
      </AppFrame>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <StatusBar style={statusBarStyle} />
      <Root styles={styles} theme={theme} />
    </ClerkProvider>
  );
}

function Root({ styles, theme }: { styles: AppStyles; theme: ThemeTokens }) {
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
    return <SignedInMockApp styles={styles} />;
  }

  return <AuthScreen styles={styles} theme={theme} />;
}

function SignedInMockApp({ styles }: { styles: AppStyles }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [state, dispatch] = useReducer(appReducer, INITIAL_APP_STATE);

  const selectedJob = state.selectedJobId ? MOCK_JOBS.find((job) => job.id === state.selectedJobId) ?? null : null;
  const selectedTemplate =
    state.selectedTemplateId ? MOCK_TEMPLATES.find((template) => template.id === state.selectedTemplateId) ?? null : null;

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
      <ScrollView contentContainerStyle={styles.homeScrollBody} showsVerticalScrollIndicator={false}>
        {state.toast ? (
          <SurfaceCard styles={styles}>
            <View style={styles.toastRow}>
              <Text style={styles.toastText}>{state.toast}</Text>
              <SecondaryCTA title="Dismiss" onPress={() => dispatch({ type: "DISMISS_TOAST" })} styles={styles} />
            </View>
          </SurfaceCard>
        ) : null}

        {state.route === "home" ? (
          <HomeHubScreen
            styles={styles}
            userEmail={user?.primaryEmailAddress?.emailAddress ?? "your account"}
            onOpenFlow={(flow) => dispatch({ type: "OPEN_FLOW", flow })}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
          />
        ) : null}

        {state.route === "job:list" ? (
          <JobListMockScreen
            styles={styles}
            jobs={MOCK_JOBS}
            onBack={() => dispatch({ type: "BACK" })}
            onOpenJob={(jobId) => dispatch({ type: "JOB_OPEN", jobId })}
          />
        ) : null}

        {state.route === "job:details" ? (
          <JobDetailsMockScreen
            styles={styles}
            job={selectedJob}
            onBack={() => dispatch({ type: "BACK" })}
            onStart={() => dispatch({ type: "JOB_START" })}
          />
        ) : null}

        {state.route === "job:complete" ? (
          <JobCompleteMockScreen
            styles={styles}
            job={selectedJob}
            onBack={() => dispatch({ type: "BACK" })}
            onComplete={() => dispatch({ type: "JOB_COMPLETE" })}
          />
        ) : null}

        {state.route === "checklist:template" ? (
          <ChecklistTemplateMockScreen
            styles={styles}
            templates={MOCK_TEMPLATES}
            selectedTemplateId={state.selectedTemplateId}
            onBack={() => dispatch({ type: "BACK" })}
            onSelectTemplate={(templateId) => dispatch({ type: "CHECKLIST_SELECT_TEMPLATE", templateId })}
          />
        ) : null}

        {state.route === "checklist:run" ? (
          <ChecklistRunMockScreen
            styles={styles}
            selectedTemplate={selectedTemplate}
            checkedIds={state.checklistCheckedIds}
            onBack={() => dispatch({ type: "BACK" })}
            onToggleItem={(itemId) => dispatch({ type: "CHECKLIST_TOGGLE_ITEM", itemId })}
            onReview={() => dispatch({ type: "CHECKLIST_REVIEW" })}
          />
        ) : null}

        {state.route === "checklist:submit" ? (
          <ChecklistSubmitMockScreen
            styles={styles}
            selectedTemplate={selectedTemplate}
            checkedCount={state.checklistCheckedIds.length}
            totalCount={CHECKLIST_ITEMS.length}
            onBack={() => dispatch({ type: "BACK" })}
            onSubmit={() => dispatch({ type: "CHECKLIST_SUBMIT" })}
          />
        ) : null}

        {state.route === "record:entry" ? (
          <RecordEntryMockScreen
            styles={styles}
            draft={state.recordDraft}
            onBack={() => dispatch({ type: "BACK" })}
            onChangeNotes={(notes) => dispatch({ type: "RECORD_UPDATE_NOTES", notes })}
            onSetPhotoCount={(photoCount) => dispatch({ type: "RECORD_SET_PHOTO_COUNT", photoCount })}
            onContinue={() => dispatch({ type: "RECORD_CONTINUE" })}
          />
        ) : null}

        {state.route === "record:review" ? (
          <RecordReviewMockScreen
            styles={styles}
            draft={state.recordDraft}
            onBack={() => dispatch({ type: "BACK" })}
            onSave={() => dispatch({ type: "RECORD_SAVE" })}
          />
        ) : null}

        {state.route === "record:saved" ? (
          <RecordSavedMockScreen
            styles={styles}
            draft={state.recordDraft}
            onBack={() => dispatch({ type: "BACK" })}
            onDone={() => dispatch({ type: "RECORD_DONE" })}
          />
        ) : null}
      </ScrollView>
    </AppFrame>
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
            <Text style={styles.subtitle}>A simple auth-ready mobile app using Expo + Clerk.</Text>
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
      <Pressable onPress={handleSignIn} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>{isSubmitting ? "Signing in..." : "Sign In"}</Text>
      </Pressable>
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
          <Pressable onPress={handleStartSignUp} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{isSubmitting ? "Creating account..." : "Create Account"}</Text>
          </Pressable>
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
          <Pressable onPress={handleVerify} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{isSubmitting ? "Verifying..." : "Verify Email"}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function HomeHubScreen({
  styles,
  userEmail,
  onOpenFlow,
  onSignOut,
  isSigningOut,
}: {
  styles: AppStyles;
  userEmail: string;
  onOpenFlow: (flow: "job" | "checklist" | "record") => void;
  onSignOut: () => void;
  isSigningOut: boolean;
}) {
  const operationButtons = [
    {
      key: "job",
      label: "Job",
      description: "Open and manage assigned cleaning jobs.",
    },
    {
      key: "checklist",
      label: "Checklist",
      description: "Step-by-step room and task checklist flow.",
    },
    {
      key: "record",
      label: "Record",
      description: "Capture completion notes and proof records.",
    },
  ] as const;

  return (
    <SurfaceCard styles={styles}>
      <Text style={styles.title}>Cleaner</Text>
      <Text style={styles.subtitle}>Signed in as {userEmail}.</Text>

      <View style={styles.operationsSection}>
        <Text style={styles.operationsTitle}>Core Operations</Text>
        <Text style={styles.operationsSubtitle}>Mockup entry points for the main mobile workflows.</Text>
        <View style={styles.operationsList}>
          {operationButtons.map((operation) => (
            <Pressable
              key={operation.key}
              style={styles.operationButton}
              onPress={() => onOpenFlow(operation.key)}
            >
              <Text style={styles.operationButtonLabel}>{operation.label}</Text>
              <Text style={styles.operationButtonDescription}>{operation.description}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <PrimaryCTA title={isSigningOut ? "Signing out..." : "Sign Out"} onPress={onSignOut} styles={styles} />
    </SurfaceCard>
  );
}

function JobListMockScreen({
  styles,
  jobs,
  onBack,
  onOpenJob,
}: {
  styles: AppStyles;
  jobs: MockJob[];
  onBack: () => void;
  onOpenJob: (jobId: string) => void;
}) {
  return (
    <SurfaceCard styles={styles}>
      <MockHeader
        styles={styles}
        title="Job"
        subtitle="Step 1 of 3: pick an assigned job to start."
        onBack={onBack}
      />
      <ProgressPill styles={styles} current={1} total={3} />
      <View style={styles.stackList}>
        {jobs.map((job) => (
          <View key={job.id} style={styles.rowCard}>
            <View style={styles.rowTop}>
              <Text style={styles.rowTitle}>{job.address}</Text>
              <Text style={styles.statusChip}>{job.status}</Text>
            </View>
            <Text style={styles.rowSubtitle}>{job.time}</Text>
            <SecondaryCTA title="Open Job" onPress={() => onOpenJob(job.id)} styles={styles} />
          </View>
        ))}
      </View>
    </SurfaceCard>
  );
}

function JobDetailsMockScreen({
  styles,
  job,
  onBack,
  onStart,
}: {
  styles: AppStyles;
  job: MockJob | null;
  onBack: () => void;
  onStart: () => void;
}) {
  const activeJob = job ?? MOCK_JOBS[0];

  return (
    <SurfaceCard styles={styles}>
      <MockHeader
        styles={styles}
        title="Job Details"
        subtitle="Step 2 of 3: verify scope and begin."
        onBack={onBack}
      />
      <ProgressPill styles={styles} current={2} total={3} />
      <View style={styles.stackList}>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Address</Text>
          <Text style={styles.infoValue}>{activeJob.address}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Service</Text>
          <Text style={styles.infoValue}>{activeJob.service}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Estimated duration</Text>
          <Text style={styles.infoValue}>{activeJob.duration}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Contact note</Text>
          <Text style={styles.infoValue}>{activeJob.contactNote}</Text>
        </View>
      </View>
      <PrimaryCTA title="Start Job" onPress={onStart} styles={styles} />
    </SurfaceCard>
  );
}

function JobCompleteMockScreen({
  styles,
  job,
  onBack,
  onComplete,
}: {
  styles: AppStyles;
  job: MockJob | null;
  onBack: () => void;
  onComplete: () => void;
}) {
  const activeJob = job ?? MOCK_JOBS[0];

  return (
    <SurfaceCard styles={styles}>
      <MockHeader
        styles={styles}
        title="Complete Job"
        subtitle="Step 3 of 3: quick completion review."
        onBack={onBack}
      />
      <ProgressPill styles={styles} current={3} total={3} />
      <View style={styles.stackList}>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Final check</Text>
          <Text style={styles.infoValue}>All rooms complete for {activeJob.address}.</Text>
        </View>
        <View style={styles.checkItemRow}>
          <Text style={styles.checkMark}>✓</Text>
          <Text style={styles.checkItemText}>Supplies gathered and removed</Text>
        </View>
        <View style={styles.checkItemRow}>
          <Text style={styles.checkMark}>✓</Text>
          <Text style={styles.checkItemText}>Doors/windows secured</Text>
        </View>
        <View style={styles.checkItemRow}>
          <Text style={styles.checkMark}>✓</Text>
          <Text style={styles.checkItemText}>Client completion photos captured</Text>
        </View>
      </View>
      <PrimaryCTA title="Mark Complete" onPress={onComplete} styles={styles} />
    </SurfaceCard>
  );
}

function ChecklistTemplateMockScreen({
  styles,
  templates,
  selectedTemplateId,
  onBack,
  onSelectTemplate,
}: {
  styles: AppStyles;
  templates: MockChecklistTemplate[];
  selectedTemplateId: string | null;
  onBack: () => void;
  onSelectTemplate: (templateId: string) => void;
}) {
  return (
    <SurfaceCard styles={styles}>
      <MockHeader
        styles={styles}
        title="Checklist"
        subtitle="Step 1 of 3: choose a template."
        onBack={onBack}
      />
      <ProgressPill styles={styles} current={1} total={3} />
      <View style={styles.stackList}>
        {templates.map((template) => {
          const isSelected = selectedTemplateId === template.id;
          return (
            <View key={template.id} style={[styles.rowCard, isSelected && styles.rowCardSelected]}>
              <Text style={styles.rowTitle}>{template.name}</Text>
              <Text style={styles.rowSubtitle}>
                {template.rooms} rooms • {template.duration}
              </Text>
              <Text style={styles.operationButtonDescription}>{template.highlight}</Text>
              <SecondaryCTA title="Use Template" onPress={() => onSelectTemplate(template.id)} styles={styles} />
            </View>
          );
        })}
      </View>
    </SurfaceCard>
  );
}

function ChecklistRunMockScreen({
  styles,
  selectedTemplate,
  checkedIds,
  onBack,
  onToggleItem,
  onReview,
}: {
  styles: AppStyles;
  selectedTemplate: MockChecklistTemplate | null;
  checkedIds: string[];
  onBack: () => void;
  onToggleItem: (itemId: string) => void;
  onReview: () => void;
}) {
  const checkedCount = checkedIds.length;
  const allComplete = checkedCount === CHECKLIST_ITEMS.length;

  return (
    <SurfaceCard styles={styles}>
      <MockHeader
        styles={styles}
        title="Checklist Run"
        subtitle={`Step 2 of 3: ${selectedTemplate?.name ?? "Standard Clean"}`}
        onBack={onBack}
      />
      <ProgressPill styles={styles} current={2} total={3} label={`${checkedCount}/${CHECKLIST_ITEMS.length} completed`} />
      <View style={styles.stackList}>
        {CHECKLIST_ITEMS.map((item) => {
          const checked = checkedIds.includes(item.id);
          return (
            <Pressable key={item.id} style={styles.checkItemRow} onPress={() => onToggleItem(item.id)}>
              <Text style={styles.checkMark}>{checked ? "✓" : "○"}</Text>
              <Text style={styles.checkItemText}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <PrimaryCTA title="Review" onPress={onReview} styles={styles} disabled={!allComplete} />
    </SurfaceCard>
  );
}

function ChecklistSubmitMockScreen({
  styles,
  selectedTemplate,
  checkedCount,
  totalCount,
  onBack,
  onSubmit,
}: {
  styles: AppStyles;
  selectedTemplate: MockChecklistTemplate | null;
  checkedCount: number;
  totalCount: number;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <SurfaceCard styles={styles}>
      <MockHeader
        styles={styles}
        title="Submit Checklist"
        subtitle="Step 3 of 3: confirm and submit."
        onBack={onBack}
      />
      <ProgressPill styles={styles} current={3} total={3} />
      <View style={styles.stackList}>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Template</Text>
          <Text style={styles.infoValue}>{selectedTemplate?.name ?? "Standard Clean"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Completion</Text>
          <Text style={styles.infoValue}>
            {checkedCount}/{totalCount} tasks completed
          </Text>
        </View>
      </View>
      <PrimaryCTA title="Submit Checklist" onPress={onSubmit} styles={styles} />
    </SurfaceCard>
  );
}

function RecordEntryMockScreen({
  styles,
  draft,
  onBack,
  onChangeNotes,
  onSetPhotoCount,
  onContinue,
}: {
  styles: AppStyles;
  draft: MockRecordDraft;
  onBack: () => void;
  onChangeNotes: (notes: string) => void;
  onSetPhotoCount: (photoCount: number) => void;
  onContinue: () => void;
}) {
  return (
    <SurfaceCard styles={styles}>
      <MockHeader
        styles={styles}
        title="Record"
        subtitle="Step 1 of 3: add notes and media."
        onBack={onBack}
      />
      <ProgressPill styles={styles} current={1} total={3} />
      <View style={styles.stackList}>
        <TextInput
          value={draft.notes}
          onChangeText={onChangeNotes}
          style={[styles.input, styles.notesInput]}
          placeholder="Add completion notes..."
          placeholderTextColor={styles.subtitle.color}
          multiline
          textAlignVertical="top"
        />
        <View style={styles.photoCounterRow}>
          <Text style={styles.infoLabel}>Photos added</Text>
          <View style={styles.photoCounterControls}>
            <SecondaryCTA title="-" onPress={() => onSetPhotoCount(Math.max(0, draft.photoCount - 1))} styles={styles} />
            <Text style={styles.infoValue}>{draft.photoCount}</Text>
            <SecondaryCTA title="+" onPress={() => onSetPhotoCount(draft.photoCount + 1)} styles={styles} />
          </View>
        </View>
      </View>
      <PrimaryCTA title="Continue" onPress={onContinue} styles={styles} />
    </SurfaceCard>
  );
}

function RecordReviewMockScreen({
  styles,
  draft,
  onBack,
  onSave,
}: {
  styles: AppStyles;
  draft: MockRecordDraft;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <SurfaceCard styles={styles}>
      <MockHeader
        styles={styles}
        title="Review Record"
        subtitle="Step 2 of 3: verify record details."
        onBack={onBack}
      />
      <ProgressPill styles={styles} current={2} total={3} />
      <View style={styles.stackList}>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Notes</Text>
          <Text style={styles.infoValue}>{draft.notes.trim() || "No notes added yet."}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Photos</Text>
          <Text style={styles.infoValue}>{draft.photoCount} files attached</Text>
        </View>
      </View>
      <PrimaryCTA title="Save Record" onPress={onSave} styles={styles} />
    </SurfaceCard>
  );
}

function RecordSavedMockScreen({
  styles,
  draft,
  onBack,
  onDone,
}: {
  styles: AppStyles;
  draft: MockRecordDraft;
  onBack: () => void;
  onDone: () => void;
}) {
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <SurfaceCard styles={styles}>
      <MockHeader
        styles={styles}
        title="Record Saved"
        subtitle="Step 3 of 3: summary ready."
        onBack={onBack}
      />
      <ProgressPill styles={styles} current={3} total={3} />
      <View style={styles.stackList}>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Saved at</Text>
          <Text style={styles.infoValue}>{timestamp}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Payload</Text>
          <Text style={styles.infoValue}>{draft.photoCount} photos with notes included</Text>
        </View>
      </View>
      <PrimaryCTA title="Done" onPress={onDone} styles={styles} />
    </SurfaceCard>
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
  return <View style={styles.homeCard}>{children}</View>;
}

function MockHeader({
  styles,
  title,
  subtitle,
  onBack,
}: {
  styles: AppStyles;
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.mockHeader}>
      <SecondaryCTA title="Back" onPress={onBack} styles={styles} />
      <Text style={styles.operationsTitle}>{title}</Text>
      <Text style={styles.operationsSubtitle}>{subtitle}</Text>
    </View>
  );
}

function ProgressPill({
  styles,
  current,
  total,
  label,
}: {
  styles: AppStyles;
  current: number;
  total: number;
  label?: string;
}) {
  return <Text style={styles.progressPill}>{label ?? `Step ${current} of ${total}`}</Text>;
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
    <Pressable onPress={onPress} style={[styles.primaryButton, disabled ? styles.primaryButtonDisabled : null]} disabled={disabled}>
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
    <Pressable onPress={onPress} style={[styles.secondaryButton, disabled ? styles.secondaryButtonDisabled : null]} disabled={disabled}>
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

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "OPEN_FLOW": {
      if (action.flow === "job") return { ...state, route: "job:list", toast: null };
      if (action.flow === "checklist") return { ...state, route: "checklist:template", toast: null };
      return { ...state, route: "record:entry", toast: null };
    }
    case "BACK": {
      switch (state.route) {
        case "job:list":
          return { ...state, route: "home" };
        case "job:details":
          return { ...state, route: "job:list" };
        case "job:complete":
          return { ...state, route: "job:details" };
        case "checklist:template":
          return { ...state, route: "home" };
        case "checklist:run":
          return { ...state, route: "checklist:template" };
        case "checklist:submit":
          return { ...state, route: "checklist:run" };
        case "record:entry":
          return { ...state, route: "home" };
        case "record:review":
          return { ...state, route: "record:entry" };
        case "record:saved":
          return { ...state, route: "record:review" };
        default:
          return state;
      }
    }
    case "JOB_OPEN": {
      if (state.route !== "job:list") return state;
      return { ...state, route: "job:details", selectedJobId: action.jobId };
    }
    case "JOB_START": {
      if (state.route !== "job:details") return state;
      return { ...state, route: "job:complete" };
    }
    case "JOB_COMPLETE": {
      if (state.route !== "job:complete") return state;
      return {
        ...state,
        route: "home",
        toast: "Job marked complete. Ready for the next assignment.",
        selectedJobId: null,
      };
    }
    case "CHECKLIST_SELECT_TEMPLATE": {
      if (state.route !== "checklist:template") return state;
      return {
        ...state,
        route: "checklist:run",
        selectedTemplateId: action.templateId,
        checklistCheckedIds: [],
      };
    }
    case "CHECKLIST_TOGGLE_ITEM": {
      if (state.route !== "checklist:run") return state;
      const exists = state.checklistCheckedIds.includes(action.itemId);
      return {
        ...state,
        checklistCheckedIds: exists
          ? state.checklistCheckedIds.filter((id) => id !== action.itemId)
          : [...state.checklistCheckedIds, action.itemId],
      };
    }
    case "CHECKLIST_REVIEW": {
      if (state.route !== "checklist:run") return state;
      if (state.checklistCheckedIds.length !== CHECKLIST_ITEMS.length) return state;
      return { ...state, route: "checklist:submit" };
    }
    case "CHECKLIST_SUBMIT": {
      if (state.route !== "checklist:submit") return state;
      return {
        ...state,
        route: "home",
        toast: "Checklist submitted successfully.",
        selectedTemplateId: null,
        checklistCheckedIds: [],
      };
    }
    case "RECORD_UPDATE_NOTES": {
      if (state.route !== "record:entry") return state;
      return {
        ...state,
        recordDraft: {
          ...state.recordDraft,
          notes: action.notes,
        },
      };
    }
    case "RECORD_SET_PHOTO_COUNT": {
      if (state.route !== "record:entry") return state;
      return {
        ...state,
        recordDraft: {
          ...state.recordDraft,
          photoCount: action.photoCount,
        },
      };
    }
    case "RECORD_CONTINUE": {
      if (state.route !== "record:entry") return state;
      return { ...state, route: "record:review" };
    }
    case "RECORD_SAVE": {
      if (state.route !== "record:review") return state;
      return { ...state, route: "record:saved" };
    }
    case "RECORD_DONE": {
      if (state.route !== "record:saved") return state;
      return {
        ...state,
        route: "home",
        toast: "Record saved and synced for review.",
      };
    }
    case "DISMISS_TOAST": {
      return { ...state, toast: null };
    }
    default:
      return state;
  }
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
    missingKeyContainer: {
      margin: 24,
      marginTop: 80,
      padding: 20,
      borderRadius: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.24,
      shadowRadius: 14,
      elevation: 2,
    },
    scrollBody: {
      paddingHorizontal: 20,
      paddingTop: 36,
      paddingBottom: 28,
      gap: 20,
    },
    homeScrollBody: {
      paddingHorizontal: 20,
      paddingTop: 30,
      paddingBottom: 30,
      gap: 12,
    },
    header: {
      gap: 8,
    },
    title: {
      fontSize: 32,
      fontWeight: "700",
      color: theme.foreground,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.mutedForeground,
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
    secondaryButtonDisabled: {
      opacity: 0.55,
    },
    secondaryButtonText: {
      color: theme.secondaryForeground,
      fontSize: 16,
      fontWeight: "600",
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
    notesInput: {
      minHeight: 130,
    },
    primaryButton: {
      marginTop: 6,
      borderRadius: 12,
      backgroundColor: theme.primary,
      paddingVertical: 12,
      alignItems: "center",
    },
    primaryButtonDisabled: {
      opacity: 0.55,
    },
    primaryButtonText: {
      color: theme.primaryForeground,
      fontSize: 16,
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
    homeCard: {
      padding: 22,
      borderRadius: 16,
      gap: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.24,
      shadowRadius: 14,
      elevation: 2,
    },
    operationsSection: {
      marginTop: 6,
      gap: 10,
    },
    operationsTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.cardForeground,
    },
    operationsSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.mutedForeground,
    },
    operationsList: {
      gap: 10,
    },
    operationButton: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.accent,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 4,
    },
    operationButtonLabel: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.secondaryForeground,
    },
    operationButtonDescription: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.mutedForeground,
    },
    mockHeader: {
      gap: 8,
      marginBottom: 2,
    },
    progressPill: {
      alignSelf: "flex-start",
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.secondary,
      color: theme.secondaryForeground,
      paddingHorizontal: 10,
      paddingVertical: 5,
      fontSize: 12,
      fontWeight: "600",
      overflow: "hidden",
    },
    stackList: {
      gap: 10,
      marginTop: 4,
    },
    rowCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
      padding: 12,
      gap: 8,
    },
    rowCardSelected: {
      borderColor: theme.ring,
    },
    rowTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
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
    },
    statusChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      color: theme.secondaryForeground,
      paddingHorizontal: 8,
      paddingVertical: 3,
      fontSize: 11,
      fontWeight: "700",
      overflow: "hidden",
    },
    infoBlock: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
      padding: 12,
      gap: 4,
    },
    infoLabel: {
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      color: theme.mutedForeground,
    },
    infoValue: {
      fontSize: 15,
      lineHeight: 21,
      color: theme.cardForeground,
      fontWeight: "600",
    },
    checkItemRow: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
      paddingHorizontal: 12,
      paddingVertical: 11,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    checkMark: {
      color: theme.primary,
      fontWeight: "800",
      fontSize: 17,
      width: 22,
    },
    checkItemText: {
      color: theme.secondaryForeground,
      fontSize: 14,
      lineHeight: 20,
      flex: 1,
    },
    photoCounterRow: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
      padding: 12,
      gap: 10,
    },
    photoCounterControls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    toastRow: {
      gap: 10,
    },
    toastText: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.secondaryForeground,
      fontWeight: "600",
    },
  });
}
