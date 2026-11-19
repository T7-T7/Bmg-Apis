import { Suspense } from "react";
import AuthForm from "@/components/auth-form";
export default function SignupPage() {
  return <Suspense fallback={<div className="auth-page"><div className="auth-card">جارٍ التحميل...</div></div>}><AuthForm mode="signup" /></Suspense>;
}
