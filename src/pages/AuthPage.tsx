import { useState } from "react";
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
  onSetMode
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
}) {
  const [formEmail, setFormEmail] = useState(email);
  const [password, setPassword] = useState("");

  if (mode === "unverified") {
    return (
      <main className="auth-shell">
        <section className="soft-card auth-card">
          <p className="section-kicker">MemoTask 账号</p>
          <h1>验证邮箱</h1>
          <p>{email}</p>
          <div className="inline-actions">
            <button className="primary-action" type="button" onClick={() => void onResendVerification()}>
              重新发送验证邮件
            </button>
            {canOpenTestVerificationLink ? (
              <button className="secondary-action" type="button" onClick={onOpenTestVerificationLink}>
                打开测试验证链接
              </button>
            ) : null}
          </div>
          <Messages error={error} message={message} />
        </section>
      </main>
    );
  }

  if (mode === "forgot") {
    return (
      <main className="auth-shell">
        <section className="soft-card auth-card">
          <p className="section-kicker">MemoTask 账号</p>
          <h1>找回密码</h1>
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
          <div className="inline-actions">
            <button className="secondary-action" type="button" onClick={() => onSetMode("login")}>
              返回登录
            </button>
            {canOpenTestResetLink ? (
              <button className="secondary-action" type="button" onClick={onOpenTestResetLink}>
                打开测试重置链接
              </button>
            ) : null}
          </div>
          <Messages error={error} message={message} />
        </section>
      </main>
    );
  }

  if (mode === "reset") {
    return (
      <main className="auth-shell">
        <section className="soft-card auth-card">
          <p className="section-kicker">MemoTask 账号</p>
          <h1>重置密码</h1>
          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              void onResetPassword(password);
            }}
          >
            <label htmlFor="auth-password">新密码</label>
            <input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <button className="primary-action" type="submit">
              更新密码
            </button>
          </form>
          <Messages error={error} message={message} />
        </section>
      </main>
    );
  }

  const isRegister = mode === "register";

  return (
    <main className="auth-shell">
      <section className="soft-card auth-card">
        <p className="section-kicker">MemoTask 账号</p>
        <h1>{isRegister ? "创建 MemoTask 账号" : "登录 MemoTask"}</h1>
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void (isRegister ? onRegister(formEmail, password) : onLogin(formEmail, password));
          }}
        >
          <label htmlFor="auth-email">邮箱</label>
          <input id="auth-email" value={formEmail} onChange={(event) => setFormEmail(event.target.value)} />
          <label htmlFor="auth-password">密码</label>
          <input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="primary-action" type="submit">
            {isRegister ? "注册" : "登录"}
          </button>
        </form>
        <div className="inline-actions">
          <button className="secondary-action" type="button" onClick={() => onSetMode(isRegister ? "login" : "register")}>
            {isRegister ? "返回登录" : "创建账号"}
          </button>
          {!isRegister ? (
            <button className="secondary-action" type="button" onClick={() => onSetMode("forgot")}>
              忘记密码
            </button>
          ) : null}
        </div>
        <Messages error={error} message={message} />
      </section>
    </main>
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
