export function SettingsPage() {
  return (
    <div className="settings-layout">
      <section className="soft-card settings-card">
        <p className="section-kicker">AI API</p>
        <label htmlFor="base-url">Base URL</label>
        <input id="base-url" placeholder="https://api.example.com/v1" />
        <label htmlFor="model">Model</label>
        <input id="model" defaultValue="dsv4-pro" />
        <label htmlFor="api-key">API Key</label>
        <input id="api-key" placeholder="sk-...b456" type="password" />
        <button className="primary-action" type="button">
          Test connection
        </button>
      </section>
      <section className="soft-card settings-card">
        <p className="section-kicker">Prompt</p>
        <textarea defaultValue="你是 MemoTask 的整理助手。" />
        <button className="secondary-action" type="button">
          Restore default
        </button>
      </section>
    </div>
  );
}
