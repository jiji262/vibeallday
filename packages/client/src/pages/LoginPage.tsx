/**
 * LoginPage - Login form for cookie-based auth.
 *
 * Shows setup form when no account exists,
 * otherwise shows login form.
 */

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AuthError,
  AuthField,
  AuthForm,
  AuthShell,
  AuthStatus,
} from "../components/auth/AuthShell";
import { Button } from "../components/garden/Button";
import { inputClassName } from "../components/garden/Field";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../i18n";

export function LoginPage() {
  const { t } = useI18n();
  const {
    isSetupMode,
    login,
    setupAccount,
    isLoading,
    authEnabled,
    authDisabledByEnv,
    limitedUsersEnabled,
  } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get the page they were trying to access before being redirected
  const from = (location.state as { from?: string } | null)?.from ?? "/inbox";

  // If auth is not enabled or disabled by env, redirect away from login page
  useEffect(() => {
    if (!isLoading && (!authEnabled || authDisabledByEnv)) {
      navigate("/inbox", { replace: true });
    }
  }, [isLoading, authEnabled, authDisabledByEnv, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError(t("loginErrorPasswordRequired"));
      return;
    }

    if (isSetupMode) {
      if (password.length < 8) {
        setError(t("loginErrorPasswordTooShort"));
        return;
      }
      if (password !== confirmPassword) {
        setError(t("loginErrorPasswordMismatch"));
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isSetupMode) {
        await setupAccount(password);
      } else {
        await login(
          password,
          (limitedUsersEnabled && username.trim()) || undefined,
        );
      }
      navigate(from, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("loginErrorAuthFailed");
      setError(
        message.includes("401") ? t("loginErrorInvalidPassword") : message,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AuthShell title={t("loginLoading")}>
        <AuthStatus>{t("loginLoading")}</AuthStatus>
      </AuthShell>
    );
  }

  const submitLabel = isSubmitting
    ? t("loginSubmitPending")
    : isSetupMode
      ? t("loginSubmitSetup")
      : t("loginSubmit");

  return (
    <AuthShell
      title={
        isSetupMode ? t("authWelcomeSetupTitle") : t("authWelcomeBackTitle")
      }
      subtitle={isSetupMode ? t("loginSetupSubtitle") : t("loginSubtitle")}
      footer={isSetupMode ? t("loginSetupHint") : t("loginRecoveryHint")}
    >
      <AuthForm onSubmit={handleSubmit}>
        {/* A named login is a limited user; blank is the owner, exactly as
            before limited users existed. The field exists only while the
            feature is on (topics/limited-users.md). */}
        {!isSetupMode && limitedUsersEnabled && (
          <AuthField id="username" label={t("loginUsernameOptional")}>
            <input
              className={inputClassName()}
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
            />
          </AuthField>
        )}
        <AuthField id="password" label={t("loginPasswordLabel")}>
          <input
            className={inputClassName()}
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              isSetupMode
                ? t("loginPasswordPlaceholderSetup")
                : t("loginPasswordPlaceholder")
            }
            disabled={isSubmitting}
          />
        </AuthField>

        {isSetupMode && (
          <AuthField
            id="confirmPassword"
            label={t("loginConfirmPasswordLabel")}
          >
            <input
              className={inputClassName()}
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("loginConfirmPasswordPlaceholder")}
              disabled={isSubmitting}
            />
          </AuthField>
        )}

        {error && <AuthError>{error}</AuthError>}

        <Button type="submit" variant="primary" block loading={isSubmitting}>
          {submitLabel}
        </Button>
      </AuthForm>
    </AuthShell>
  );
}
