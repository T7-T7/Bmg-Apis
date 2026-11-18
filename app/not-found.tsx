import Link from "next/link";

export default function NotFoundPage() {
  return <div className="panel not-found-panel"><div className="eyebrow">404 · NOT FOUND</div><h1>Page not found</h1><p>The page you are looking for doesn’t exist or has moved.</p><Link className="primary-btn" href="/">Return to Dashboard</Link></div>;
}