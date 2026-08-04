export default function AdminLoading() {
  return (
    <section
      className="workspace-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Opening admin section"
    >
      <div className="workspace-loading__intro">
        <p className="workspace-loading__label">Admin operations</p>
        <p className="workspace-loading__title">Preparing this view…</p>
      </div>
      <div className="workspace-loading__grid" aria-hidden="true">
        <div className="workspace-loading__card" />
        <div className="workspace-loading__card" />
        <div className="workspace-loading__card" />
        <div className="workspace-loading__card" />
      </div>
    </section>
  );
}
