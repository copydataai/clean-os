import { ClerkProvider, useAuth, useClerk, useSSO, useSignIn, useSignUp, useUser } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
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
    return <HomeScreen styles={styles} />;
  }

  return <AuthScreen styles={styles} theme={theme} />;
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
        <Text style={styles.secondaryButtonText}>
          {isSubmitting ? "Connecting..." : "Continue with Google"}
        </Text>
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
            <Text style={styles.primaryButtonText}>
              {isSubmitting ? "Creating account..." : "Create Account"}
            </Text>
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

function HomeScreen({ styles }: { styles: AppStyles }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);
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
  ];

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
        <View style={styles.homeCard}>
          <Text style={styles.title}>Cleaner</Text>
          <Text style={styles.subtitle}>
            Signed in as {user?.primaryEmailAddress?.emailAddress ?? "your account"}.
          </Text>

          <View style={styles.operationsSection}>
            <Text style={styles.operationsTitle}>Core Operations</Text>
            <Text style={styles.operationsSubtitle}>
              Mockup entry points for the main mobile workflows.
            </Text>
            <View style={styles.operationsList}>
              {operationButtons.map((operation) => (
                <Pressable key={operation.key} style={styles.operationButton}>
                  <Text style={styles.operationButtonLabel}>{operation.label}</Text>
                  <Text style={styles.operationButtonDescription}>{operation.description}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable onPress={handleSignOut} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{isSigningOut ? "Signing out..." : "Sign Out"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </AppFrame>
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
      alignItems: "center",
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
    primaryButton: {
      marginTop: 4,
      borderRadius: 12,
      backgroundColor: theme.primary,
      paddingVertical: 12,
      alignItems: "center",
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
      margin: 20,
      marginTop: 80,
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
    homeScrollBody: {
      paddingBottom: 30,
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
  });
}
