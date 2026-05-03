import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRegister, useGetColleges } from "@workspace/api-client-react";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [collegeId, setCollegeId] = useState("");
  
  const colors = useColors();
  const { login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const registerMutation = useRegister();
  const { data: collegesData, isLoading: loadingColleges } = useGetColleges();

  const handleRegister = () => {
    if (!email || !password || !name || !collegeId) return;
    registerMutation.mutate(
      { data: { email, password, name, collegeId } },
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
          placeholder="Name"
          placeholderTextColor={colors.mutedForeground}
          value={name}
          onChangeText={setName}
        />
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
          placeholder="Password"
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

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleRegister}
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Register</Text>
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
