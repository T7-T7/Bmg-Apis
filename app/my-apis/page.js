import Link from "next/link";
export default function MyApis(){return <>
<div className="page-heading"><div><div className="eyebrow">WORKSPACE</div><h1>My APIs</h1><p>Manage drafts and published APIs. Workspace data is not connected yet.</p></div><Link href="/create" className="primary-btn">＋ New API</Link></div>
<div className="panel"><div className="empty-state"><div style={{fontSize:24,marginBottom:10}}>▤</div><strong style={{color:"var(--text)"}}>Your workspace is empty</strong><p>Created APIs will appear here once API storage is implemented.</p><Link href="/create" className="primary-btn" style={{marginTop:12}}>Create first API</Link></div></div>
</>}