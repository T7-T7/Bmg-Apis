export default function LoadingPage() {
  return <div className="loading-layout" aria-label="جارٍ تحميل الصفحة"><div className="skeleton hero-skeleton" /><div className="stats-grid">{[1,2,3,4].map(item=><div className="skeleton stat-skeleton" key={item}/>)}</div><div className="card-grid">{[1,2,3].map(item=><div className="skeleton card-skeleton" key={item}/>)}</div></div>;
}