import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useSignUp, useSSO, useAuth } from "@clerk/expo";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => { void WebBrowser.coolDownAsync(); };
  }, []);
}

export default function SignUpScreen() {
  useWarmUpBrowser();

  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [oauthLoading, setOauthLoading] = useState<"google" | "linkedin" | null>(null);

  if (isSignedIn) return null;

  const handleSignUp = async () => {
    if (!email.trim() || !password) return;
    const { error } = await signUp.password({ emailAddress: email.trim(), password });
    if (error) return;
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code: verifyCode });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          const url = decorateUrl("/");
          if (url.startsWith("http")) {
            (globalThis as any).location && ((globalThis as any).location.href = url);
          } else {
            router.replace(url as any);
          }
        },
      });
    }
  };

  const handleOAuth = useCallback(async (provider: "oauth_google" | "oauth_linkedin_oidc") => {
    const label = provider === "oauth_google" ? "google" : "linkedin";
    setOauthLoading(label as any);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: provider,
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId) {
        await setActive!({
          session: createdSessionId,
          navigate: async ({ decorateUrl }) => router.replace(decorateUrl("/") as any),
        });
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "OAuth sign-up failed");
    } finally {
      setOauthLoading(null);
    }
  }, [startSSOFlow, router]);

  if (
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0
  ) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.inner, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.logoSection}>
            <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
              <Ionicons name="mail-unread-outline" size={32} color="#fff" />
            </View>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>Check your email</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: "center" }]}>
              We sent a 6-digit code to{"\n"}{email}
            </Text>
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Ionicons name="keypad-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.inputField, { color: colors.foreground }]}
              placeholder="6-digit code"
              placeholderTextColor={colors.mutedForeground}
              value={verifyCode}
              onChangeText={setVerifyCode}
              keyboardType="numeric"
              maxLength={6}
              autoFocus
            />
          </View>
          {errors?.fields?.code && (
            <Text style={styles.error}>{errors.fields.code.message}</Text>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: fetchStatus === "fetching" ? 0.7 : 1 }]}
            onPress={handleVerify}
            disabled={fetchStatus === "fetching" || verifyCode.length < 6}
          >
            {fetchStatus === "fetching" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Verify Email</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => signUp.verifications.sendEmailCode()}>
            <Text style={[styles.linkText, { color: colors.primary }]}>Resend code</Text>
          </TouchableOpacity>

          <View nativeID="clerk-captcha" />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            <Ionicons name="school" size={36} color="#fff" />
          </View>
          <Text style={[styles.appName, { color: colors.foreground }]}>Campus Connect</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>Join your college community</Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Create account</Text>

          <View style={styles.oauthRow}>
            <TouchableOpacity
              style={[styles.oauthBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => handleOAuth("oauth_google")}
              disabled={!!oauthLoading}
            >
              {oauthLoading === "google" ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="logo-google" size={20} color="#EA4335" />
              )}
              <Text style={[styles.oauthBtnText, { color: colors.foreground }]}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.oauthBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => handleOAuth("oauth_linkedin_oidc")}
              disabled={!!oauthLoading}
            >
              {oauthLoading === "linkedin" ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="logo-linkedin" size={20} color="#0A66C2" />
              )}
              <Text style={[styles.oauthBtnText, { color: colors.foreground }]}>LinkedIn</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or sign up with email</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.inputField, { color: colors.foreground }]}
              placeholder="College email"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>
          {errors?.fields?.emailAddress && (
            <Text style={styles.error}>{errors.fields.emailAddress.message}</Text>
          )}

          <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.inputField, { color: colors.foreground }]}
              placeholder="Password (min 8 chars)"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {errors?.fields?.password && (
            <Text style={styles.error}>{errors.fields.password.message}</Text>
          )}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { backgroundColor: colors.primary, opacity: (!email || !password || fetchStatus === "fetching") ? 0.6 : 1 },
            ]}
            onPress={handleSignUp}
            disabled={!email || !password || fetchStatus === "fetching"}
          >
            {fetchStatus === "fetching" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/sign-in" as any)}>
              <Text style={[styles.footerLink, { color: colors.primary }]}>Sign in</Text>
            </TouchableOpacity>
          </View>

          <View nativeID="clerk-captcha" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 16,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 28,
    gap: 8,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  appName: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    fontWeight: "400",
  },
  form: {
    gap: 14,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  oauthRow: {
    flexDirection: "row",
    gap: 12,
  },
  oauthBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  oauthBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 8,
  },
  inputIcon: {
    width: 20,
  },
  inputField: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  eyeBtn: {
    padding: 4,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 4,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "600",
  },
  linkBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 15,
    fontWeight: "600",
  },
  error: {
    color: "#ef4444",
    fontSize: 13,
    marginTop: -6,
  },
});
