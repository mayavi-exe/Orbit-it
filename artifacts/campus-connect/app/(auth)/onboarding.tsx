import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useUser, useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import {
  useGetColleges,
  setAuthTokenGetter,
  getGetMeQueryKey,
} from "@workspace/api-client-react";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 20);
}

function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();

  const defaultEmail =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    "";

  const defaultName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  const [name, setName] = useState(defaultName);
  const [username, setUsername] = useState(slugify(defaultName));
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [collegeId, setCollegeId] = useState("");
  const [loading, setLoading] = useState(false);

  const suggestedUsername = useMemo(() => slugify(name), [name]);
  const displayUsername = usernameEdited ? username : suggestedUsername;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!usernameEdited) setUsername(slugify(val));
  };

  const { data: collegesData, isLoading: loadingColleges } = useGetColleges();

  const handleContinue = async () => {
    if (!name.trim()) {
      showAlert("Missing info", "Please fill in your name.");
      return;
    }
    if (!collegeId) {
      showAlert("Missing info", "Please select your college.");
      return;
    }
    if (!userLoaded) return;

    const email =
      defaultEmail ||
      user?.emailAddresses?.[0]?.emailAddress;

    if (!email) {
      showAlert(
        "Error",
        "Could not load your email address. Please sign out and try again."
      );
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        showAlert("Error", "Not authenticated. Please sign in again.");
        return;
      }

      const baseUrl = process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : "";

      const res = await fetch(`${baseUrl}/api/auth/provision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email,
          collegeId,
          username: displayUsername || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error === "CONFLICT") {
          showAlert(
            "Username taken",
            "That username is already in use. Please choose another."
          );
          return;
        }
        showAlert(
          "Error",
          err.message ?? "Failed to set up profile. Please try again."
        );
        return;
      }

      setAuthTokenGetter(() => getToken());
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      router.replace("/(tabs)" as any);
    } catch {
      showAlert("Error", "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!(name.trim() && collegeId && userLoaded && !loading);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
          <Ionicons name="person-add-outline" size={28} color="#fff" />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Complete your profile
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          One last step — tell us about yourself
        </Text>
      </View>

      {!userLoaded ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading your account…
          </Text>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            Your name
          </Text>
          <View
            style={[
              styles.inputWrapper,
              { backgroundColor: colors.input, borderColor: colors.border },
            ]}
          >
            <Ionicons name="person-outline" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.inputField, { color: colors.foreground }]}
              placeholder="Full name"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={handleNameChange}
            />
          </View>

          <Text style={[styles.label, { color: colors.foreground }]}>
            Username
          </Text>
          <View
            style={[
              styles.inputWrapper,
              { backgroundColor: colors.input, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.atSign, { color: colors.primary }]}>@</Text>
            <TextInput
              style={[styles.inputField, { color: colors.foreground }]}
              placeholder="your.handle"
              placeholderTextColor={colors.mutedForeground}
              value={displayUsername}
              onChangeText={(val) => {
                setUsername(val.toLowerCase().replace(/[^a-z0-9._]/g, ""));
                setUsernameEdited(true);
              }}
              autoCapitalize="none"
              maxLength={30}
            />
          </View>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            <Ionicons name="lock-closed-outline" size={11} /> This cannot be
            changed later
          </Text>

          <Text
            style={[styles.label, { color: colors.foreground, marginTop: 8 }]}
          >
            Select your college
          </Text>
          {loadingColleges ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginVertical: 12 }}
            />
          ) : (
            <View style={styles.collegeGrid}>
              {(collegesData?.colleges ?? []).map((college) => (
                <TouchableOpacity
                  key={college.id}
                  style={[
                    styles.collegeChip,
                    {
                      backgroundColor:
                        collegeId === college.id
                          ? colors.primary
                          : colors.card,
                      borderColor:
                        collegeId === college.id
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                  onPress={() => setCollegeId(college.id)}
                >
                  <Ionicons
                    name="school-outline"
                    size={14}
                    color={
                      collegeId === college.id ? "#fff" : colors.mutedForeground
                    }
                  />
                  <Text
                    style={[
                      styles.collegeChipText,
                      {
                        color:
                          collegeId === college.id ? "#fff" : colors.foreground,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {college.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.continueBtn,
              {
                backgroundColor: colors.primary,
                opacity: canSubmit ? 1 : 0.6,
              },
            ]}
            onPress={handleContinue}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.continueBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  loadingBox: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 14,
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: -4,
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
  atSign: {
    fontSize: 18,
    fontWeight: "700",
  },
  inputField: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  hint: {
    fontSize: 12,
    marginTop: -4,
    marginLeft: 2,
  },
  collegeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  collegeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  collegeChipText: {
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 140,
  },
  continueBtn: {
    height: 54,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  continueBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
