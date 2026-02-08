import { ClerkProvider, useAuth, useClerk, useSignIn, useSignUp, useUser } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
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
} from "react-native";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

type AuthMode = "sign-in" | "sign-up";

export default function App() {
  if (!publishableKey) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.missingKeyContainer}>
          <Text style={styles.title}>Cleaner</Text>
          <Text style={styles.subtitle}>
            Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your environment before starting the app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <StatusBar style="dark" />
      <Root />
    </ClerkProvider>
  );
}

function Root() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1d7d49" />
        </View>
      </SafeAreaView>
    );
  }

  if (isSignedIn) {
    return <HomeScreen />;
  }

  return <AuthScreen />;
}

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("sign-in");

  return (
    <SafeAreaView style={styles.screen}>
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

          {mode === "sign-in" ? <SignInForm /> : <SignUpForm />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SignInForm() {
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
        placeholderTextColor="#7d8f82"
        style={styles.input}
        value={email}
      />
      <TextInput
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#7d8f82"
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

function SignUpForm() {
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
            placeholderTextColor="#7d8f82"
            style={styles.input}
            value={email}
          />
          <TextInput
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#7d8f82"
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
            placeholderTextColor="#7d8f82"
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

function HomeScreen() {
  const { user } = useUser();
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
    <SafeAreaView style={styles.screen}>
      <View style={styles.homeCard}>
        <Text style={styles.title}>Cleaner</Text>
        <Text style={styles.subtitle}>
          Signed in as {user?.primaryEmailAddress?.emailAddress ?? "your account"}.
        </Text>
        <Pressable onPress={handleSignOut} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{isSigningOut ? "Signing out..." : "Sign Out"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: "#f4f7f3",
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
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d5e5d9",
    gap: 8,
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
    color: "#153c24",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#456251",
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#e5eee8",
    borderRadius: 14,
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
    backgroundColor: "#ffffff",
  },
  toggleText: {
    color: "#4c6d5b",
    fontWeight: "600",
  },
  toggleTextActive: {
    color: "#143924",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d5e5d9",
    padding: 18,
    gap: 12,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#143924",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c8dccd",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#143924",
    fontSize: 16,
    backgroundColor: "#f8fbf7",
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: "#1d7d49",
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#a02f2f",
    fontSize: 14,
  },
  verificationText: {
    color: "#456251",
    fontSize: 14,
    lineHeight: 20,
  },
  homeCard: {
    margin: 20,
    marginTop: 80,
    padding: 22,
    borderRadius: 16,
    gap: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d5e5d9",
  },
});
