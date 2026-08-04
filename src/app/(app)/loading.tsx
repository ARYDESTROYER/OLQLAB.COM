export default function WorkspaceLoading() {
  return (
    <section
      className="workspace-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Opening workspace section"
    >
      <div className="workspace-loading__intro">
        <p className="workspace-loading__label">OLQLAB Workspace</p>
        <p className="workspace-loading__title">Opening this section…</p>
      </div>
      <div className="workspace-loading__grid" aria-hidden="true">
        <div className="workspace-loading__card" />
        <div className="workspace-loading__card" />
      </div>
    </section>
  );
}
