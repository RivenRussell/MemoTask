import type { AiSettingsDraft } from "../state/app-state";
import type { AiSettingsView, SyncStatusView } from "../types";

interface SettingsPageProps {
  draft: AiSettingsDraft;
  settings: AiSettingsView | null;
  syncStatus: SyncStatusView | null;
  message: string | null;
  error: string | null;
  onUpdateDraft: (patch: Partial<AiSettingsDraft>) => void;
  onSave: () => void;
  onTestConnection: () => void;
  onResetPrompt: () => void;
  onExportJson: () => void;
}

export function SettingsPage({
  draft,
  settings,
  syncStatus,
  message,
  error,
  onUpdateDraft,
  onSave,
  onTestConnection,
  onResetPrompt,
  onExportJson
}: SettingsPageProps) {
  return (
    <div className="settings-layout">
      <section className="soft-card settings-card">
        <p className="section-kicker">AI API</p>
        <label htmlFor="base-url">接口地址</label>
        <input
          id="base-url"
          placeholder="https://api.deepseek.com"
          value={draft.baseUrl}
          onChange={(event) => onUpdateDraft({ baseUrl: event.target.value })}
        />
        <label htmlFor="model">模型</label>
        <input
          id="model"
          placeholder="deepseek-v4-pro"
          value={draft.model}
          onChange={(event) => onUpdateDraft({ model: event.target.value })}
        />
        <label htmlFor="api-key">API 密钥</label>
        <input
          id="api-key"
          placeholder={settings?.apiKeyMask ?? "sk-...last4"}
          type="password"
          value={draft.apiKey}
          onChange={(event) => onUpdateDraft({ apiKey: event.target.value })}
        />
        {settings?.apiKeyMask ? <p className="field-hint">当前已保存：{settings.apiKeyMask}</p> : null}
        {syncStatus ? <p className="field-hint">同步状态：{syncStatus.ok ? "正常" : "异常"}</p> : null}
        <div className="inline-actions">
          <button className="primary-action" type="button" onClick={onSave}>
            保存设置
          </button>
          <button className="secondary-action" type="button" onClick={onTestConnection}>
            测试连接
          </button>
          <button className="secondary-action" type="button" onClick={onExportJson}>
            导出 JSON
          </button>
        </div>
        {message ? <p className="status-message">{message}</p> : null}
        {error ? <p className="status-message status-message-error">{error}</p> : null}
      </section>
      <section className="soft-card settings-card">
        <p className="section-kicker">Prompt</p>
        <label htmlFor="prompt-template">Prompt</label>
        <textarea
          id="prompt-template"
          value={draft.promptTemplate}
          onChange={(event) => onUpdateDraft({ promptTemplate: event.target.value })}
        />
        <button className="secondary-action" type="button" onClick={onResetPrompt}>
          恢复默认 Prompt
        </button>
      </section>
    </div>
  );
}
