export default function App() {
  return (
    <main className="app-shell">
      <section className="hero-panel" aria-labelledby="app-title">
        <p className="eyebrow">MemoTask V1</p>
        <h1 id="app-title">把想法整理成可以处理的 Memo</h1>
        <p className="intro">
          当前工程骨架已接入 Cloudflare Worker、D1 绑定和中文前端入口。后续页面会按 Capture、Memos、Settings
          以及 History 流程逐步完善。
        </p>
      </section>
    </main>
  );
}
