export default function LoadingPage() {
  return (
    <div className="loading-layout" aria-label="جارٍ تحميل الصفحة" aria-busy="true">
      <div className="skeleton hero-skeleton" />
      <div className="overview-stats">
        {[1, 2, 3].map(item => <div className="skeleton stat-skeleton" key={item} />)}
      </div>
      <div className="api-grid">
        {[1, 2, 3].map(item => <div className="skeleton card-skeleton" key={item} />)}
      </div>
    </div>
  );
}