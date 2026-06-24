import { Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { AuthMode } from "../state/app-state";

export function AuthPage({
  mode,
  email,
  error,
  message,
  canOpenTestVerificationLink,
  canOpenTestResetLink,
  onForgotPassword,
  onLogin,
  onOpenTestResetLink,
  onOpenTestVerificationLink,
  onRegister,
  onResetPassword,
  onResendVerification,
  onSetMode,
  onVerifyEmail
}: {
  mode: AuthMode;
  email: string;
  error: string | null;
  message: string | null;
  canOpenTestVerificationLink: boolean;
  canOpenTestResetLink: boolean;
  onForgotPassword: (email: string) => Promise<void>;
  onLogin: (email: string, password: string) => Promise<void>;
  onOpenTestResetLink: () => void;
  onOpenTestVerificationLink: () => void;
  onRegister: (email: string, password: string) => Promise<void>;
  onResetPassword: (password: string) => Promise<void>;
  onResendVerification: () => Promise<void>;
  onSetMode: (mode: AuthMode) => void;
  onVerifyEmail: (code: string) => Promise<void>;
}) {
  const [formEmail, setFormEmail] = useState(email);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setFormEmail(email);
  }, [email]);

  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
    setVerificationCode("");
    setShowPassword(false);
    setLocalError(null);
  }, [mode]);

  useEffect(() => {
    function fillTestCode(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      setVerificationCode(detail);
    }

    window.addEventListener("memotask:test-verification-code", fillTestCode);
    return () => window.removeEventListener("memotask:test-verification-code", fillTestCode);
  }, []);

  if (mode === "unverified") {
    return (
      <AuthFrame title="验证邮箱">
        <p className="auth-email-display">{email}</p>
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onVerifyEmail(verificationCode);
          }}
        >
          <label htmlFor="auth-code">邮箱验证码</label>
          <input
            id="auth-code"
            inputMode="numeric"
            maxLength={6}
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="输入 6 位验证码"
          />
          <button className="primary-action" type="submit">
            验证邮箱
          </button>
        </form>
        <div className="auth-support-actions">
          <button className="text-action" type="button" onClick={() => void onResendVerification()}>
            重新发送验证码
          </button>
          <button className="text-action" type="button" onClick={() => onSetMode("login")}>
            返回登录
          </button>
          {canOpenTestVerificationLink ? (
            <button className="text-action" type="button" onClick={onOpenTestVerificationLink}>
              填入测试验证码
            </button>
          ) : null}
        </div>
        <Messages error={localError ?? error} message={message} />
      </AuthFrame>
    );
  }

  if (mode === "forgot") {
    return (
      <AuthFrame title="找回密码">
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onForgotPassword(formEmail);
          }}
        >
          <label htmlFor="auth-email">邮箱</label>
          <input id="auth-email" value={formEmail} onChange={(event) => setFormEmail(event.target.value)} />
          <button className="primary-action" type="submit">
            发送重置邮件
          </button>
        </form>
        <div className="auth-support-actions">
          <button className="text-action" type="button" onClick={() => onSetMode("login")}>
            返回登录
          </button>
          {canOpenTestResetLink ? (
            <button className="text-action" type="button" onClick={onOpenTestResetLink}>
              打开测试重置链接
            </button>
          ) : null}
        </div>
        <Messages error={localError ?? error} message={message} />
      </AuthFrame>
    );
  }

  if (mode === "reset") {
    return (
      <AuthFrame title="重置密码">
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onResetPassword(password);
          }}
        >
          <PasswordField
            id="auth-password"
            label="新密码"
            password={password}
            showPassword={showPassword}
            onPasswordChange={setPassword}
            onToggleShow={() => setShowPassword((current) => !current)}
          />
          <p className="field-hint">至少 6 位，并同时包含英文字母和数字</p>
          <button className="primary-action" type="submit">
            更新密码
          </button>
        </form>
        <Messages error={localError ?? error} message={message} />
      </AuthFrame>
    );
  }

  const isRegister = mode === "register";

  return (
    <AuthFrame title={isRegister ? "创建 MemoTask 账号" : "登录 MemoTask"}>
      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          setLocalError(null);
          if (isRegister && password !== confirmPassword) {
            setLocalError("两次输入的密码不一致");
            return;
          }
          void (isRegister ? onRegister(formEmail, password) : onLogin(formEmail, password));
        }}
      >
        <label htmlFor="auth-email">邮箱</label>
        <input id="auth-email" value={formEmail} onChange={(event) => setFormEmail(event.target.value)} />
        <PasswordField
          id="auth-password"
          label="密码"
          password={password}
          showPassword={showPassword}
          onPasswordChange={setPassword}
          onToggleShow={() => setShowPassword((current) => !current)}
        />
        {isRegister ? (
          <>
            <label htmlFor="auth-confirm-password">确认密码</label>
            <input
              id="auth-confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <p className="field-hint">至少 6 位，并同时包含英文字母和数字</p>
          </>
        ) : null}
        <button className="primary-action" type="submit">
          {isRegister ? "注册" : "登录"}
        </button>
      </form>
      <div className="auth-support-actions">
        <button className="text-action" type="button" onClick={() => onSetMode(isRegister ? "login" : "register")}>
          {isRegister ? "返回登录" : "创建账号"}
        </button>
        {!isRegister ? (
          <button className="text-action" type="button" onClick={() => onSetMode("forgot")}>
            忘记密码
          </button>
        ) : null}
      </div>
      <Messages error={localError ?? error} message={message} />
    </AuthFrame>
  );
}

function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="auth-shell">
      <img className="auth-background-asset auth-background-corner" src="/assets/ui/corner-fluid-shapes.png" alt="" aria-hidden="true" />
      <img className="auth-background-asset auth-background-glow" src="/assets/ui/top-breathing-glow.png" alt="" aria-hidden="true" />
      <section className="auth-layout" aria-label="MemoTask 账号">
        <aside className="auth-visual-panel" aria-hidden="true">
          <div className="brand-mark auth-brand-mark">
            <div className="brand-icon">M</div>
            <div>
              <p>MemoTask</p>
            </div>
          </div>
          <div className="auth-orb-stage">
            <img className="auth-orb-asset" src="/assets/ui/ai-magic-orb.png" alt="" aria-hidden="true" />
            <div className="auth-floating-icons">
              <span>
                <Mail size={18} />
              </span>
              <span>
                <ShieldCheck size={18} />
              </span>
              <span>
                <LockKeyhole size={18} />
              </span>
              <span>
                <KeyRound size={18} />
              </span>
            </div>
          </div>
          <div className="auth-visual-dots">
            <span />
            <span />
            <span />
          </div>
        </aside>
        <section className="soft-card auth-card">
          <p className="section-kicker">MemoTask 账号</p>
          <h1>{title}</h1>
          {children}
        </section>
      </section>
    </main>
  );
}

function PasswordField({
  id,
  label,
  password,
  showPassword,
  onPasswordChange,
  onToggleShow
}: {
  id: string;
  label: string;
  password: string;
  showPassword: boolean;
  onPasswordChange: (password: string) => void;
  onToggleShow: () => void;
}) {
  const Icon = showPassword ? EyeOff : Eye;
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input id={id} type={showPassword ? "text" : "password"} value={password} onChange={(event) => onPasswordChange(event.target.value)} />
        <button className="text-action password-toggle" type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={onToggleShow}>
          <Icon size={18} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

function Messages({ error, message }: { error: string | null; message: string | null }) {
  return (
    <>
      {message ? <p className="status-message">{message}</p> : null}
      {error ? <p className="status-message status-message-error">{error}</p> : null}
    </>
  );
}
