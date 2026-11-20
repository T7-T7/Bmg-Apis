import { Suspense } from "react";
import AuthForm from "@/components/auth-form";

export default function LoginPage() {
  return <Suspense fallback={<main className="source-auth-page"><div className="source-auth-loading"><span className="source-auth-mark">B</span><p>جارٍ تجهيز تسجيل الدخول...</p></div></main>}>
    <AuthForm />
  </Suspense>;
}
