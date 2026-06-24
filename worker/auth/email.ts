import type { EmailMessage, EmailSender } from "./types";

interface EmailEnv {
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_BASE_URL?: string;
}

export class EmailConfigurationError extends Error {
  constructor(message = "邮件服务未配置") {
    super(message);
  }
}

export class EmailDeliveryError extends Error {
  constructor(message = "邮件发送失败") {
    super(message);
  }
}

export function createEmailSender(env: EmailEnv, fetcher: typeof fetch = (request, init) => fetch(request, init)): EmailSender {
  return new ResendEmailSender(env, fetcher);
}

class ResendEmailSender implements EmailSender {
  constructor(
    private readonly env: EmailEnv,
    private readonly fetcher: typeof fetch
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const apiKey = this.env.EMAIL_API_KEY?.trim();
    const from = this.env.EMAIL_FROM?.trim();
    const appBaseUrl = this.env.APP_BASE_URL?.trim();
    if (!apiKey || !from || !appBaseUrl) {
      throw new EmailConfigurationError();
    }

    const response = await this.fetcher(
      new Request("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: `<p>${escapeHtml(message.text)}</p><p><a href="${escapeAttribute(message.actionUrl)}">打开链接</a></p>`
        })
      })
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Email delivery failed", { status: response.status, body: body.slice(0, 500) });
      throw new EmailDeliveryError();
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
