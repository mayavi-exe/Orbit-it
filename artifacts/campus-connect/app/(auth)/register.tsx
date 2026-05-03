import React, { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRegister, useGetColleges } from "@workspace/api-client-react";

function suggestUsername(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 20);
  return base || "";
}

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);

  const colors = useColors();
  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const registerMutation = useRegister();
  const { data: collegesData, isLoading: loadingColleges } = useGetColleges();

  const suggestedUsername = useMemo(() => suggestUsername(name), [name]);
  const displayUsername = usernameEdited ? username : suggestedUsername;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!usernameEdited) {
      setUsername(suggestUsername(val));
    }
  };

  const handleRegister = () => {
    if (!email || !password || !name || !collegeId) return;
    registerMutation.mutate(
      { data: { email, password, name, collegeId, username: displayUsername || undefined } },
      {
        onSuccess: (data) => {
          login(data);
        },
      }
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
      <Text style={[styles.title, { color: colors.foreground }]}>Create Account</Text>

      <View style={styles.form}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
          placeholder="Full Name"
          placeholderTextColor={colors.mutedForeground}
          value={name}
          onChangeText={handleNameChange}
        />

        <View>
          <View style={[styles.usernameContainer, { backgroundColor: colors.input }]}>
            <Text style={[styles.atSign, { color: colors.primary }]}>@</Text>
            <TextInput
              style={[styles.usernameInput, { color: colors.foreground }]}
              placeholder="username"
              placeholderTextColor={colors.mutedForeground}
              value={displayUsername}
              onChangeText={(val) => {
                const clean = val.toLowerCase().replace(/[^a-z0-9._]/g, "");
                setUsername(clean);
                setUsernameEdited(true);
              }}
              autoCapitalize="none"
              maxLength={30}
            />
          </View>
          <Text style={[styles.usernameHint, { color: colors.mutedForeground }]}>
            This is your unique handle — cannot be changed later
          </Text>
        </View>

        <TextInput
          style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
          placeholder="Email"
          placeholderTextColor={colors.mutedForeground}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
          placeholder="Password (min 8 characters)"
          placeholderTextColor={colors.mutedForeground}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Select College</Text>
        {loadingColleges ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View style={styles.collegeList}>
            {collegesData?.colleges?.map((college) => (
              <TouchableOpacity
                key={college.id}
                style={[
                  styles.collegeItem,
                  {
                    backgroundColor: collegeId === college.id ? colors.primary : colors.card,
                    borderColor: colors.border,
                    borderWidth: 1
                  }
                ]}
                onPress={() => setCollegeId(college.id)}
              >
                <Text style={{ color: collegeId === college.id ? colors.primaryForeground : colors.foreground }}>
                  {college.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {registerMutation.isError && (
          <View style={[styles.errorBox, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
            <Text style={{ color: "#ef4444", fontSize: 14 }}>
              {(registerMutation.error as any)?.message ?? "Registration failed. Try again."}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleRegister}
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Create Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/login")} style={styles.linkButton}>
          <Text style={[styles.linkText, { color: colors.primary }]}>Already have an account? Login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  usernameContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  atSign: {
    fontSize: 18,
    fontWeight: "700",
    marginRight: 2,
  },
  usernameInput: {
    flex: 1,
    fontSize: 16,
  },
  usernameHint: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  collegeList: {
    gap: 8,
  },
  collegeItem: {
    padding: 16,
    borderRadius: 12,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  button: {
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    alignItems: "center",
    marginTop: 16,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
