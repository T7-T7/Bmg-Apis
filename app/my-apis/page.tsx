import Link from "next/link";

export default function MyApisPage() {
  return (
    <>
      <div className="page-heading"><div><div className="eyebrow">WORKSPACE</div><h1>My APIs</h1><p>Manage drafts and published APIs. Workspace data is not connected yet.</p></div><Link href="/create" className="primary-btn">＋ New API</Link></div>
      <div className="panel"><div className="empty-state"><div className="empty-icon">▤</div><strong className="empty-title">Your workspace is empty</strong><p>Created APIs will appear here once API storage is implemented.</p><Link href="/create" className="primary-btn empty-action">Create first API</Link></div></div>
    </>
  );
}