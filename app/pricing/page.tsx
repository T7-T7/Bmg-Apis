"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpLeft, Check, Crown, Headphones, Infinity, ShieldCheck, Zap } from "lucide-react";

const plans = [
  { id: "free", name: "Free", price: "مجاني", note: "للتجربة والتعلّم", description: "ابدأ باستكشاف المنصة واختبر الخدمة المتاحة.", icon: Zap, features: ["الوصول إلى الكتالوج والتوثيق", "Playground تجريبي", "مفتاح API واحد", "30 طلبًا في الدقيقة", "دعم المجتمع"], action: "ابدأ مجانًا", href: "/signup?next=/dashboard" },
  { id: "pro", name: "Pro", price: "قريبًا", note: "للمطورين والمشاريع النشطة", description: "حدود أعلى وأدوات متابعة أكثر لمشاريعك.", icon: Crown, featured: true, features: ["كل مزايا Free", "حدود استخدام أعلى", "مفاتيح متعددة", "سجل طلبات وتحليلات", "أولوية في الدعم"], action: "انضم إلى قائمة Pro", href: "/signup?next=/dashboard" },
  { id: "business", name: "Business", price: "حسب الاتفاق", note: "للفرق والمنتجات", description: "خيارات مرنة للمشاريع التي تحتاج تكاملًا مخصصًا.", icon: Headphones, features: ["كل مزايا Pro", "إدارة أعضاء الفريق", "حدود مخصصة", "دعم تكامل مخصص", "اتفاقية خدمة عند التفعيل"], action: "تواصل معنا", href: "/create" },
];

const reveal = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: .5, ease: "easeOut" as const } } };

export default function PricingPage() {
  return (
    <div className="nox-pricing">
      <motion.section className="pricing-intro" variants={reveal} initial="hidden" animate="visible">
        <span className="eyebrow"><ShieldCheck size={14} /> SIMPLE, TRANSPARENT ACCESS</span>
        <h1>خطة تناسب طريقة بنائك.</h1>
        <p>ابدأ مجانًا. وعندما تتوسع احتياجاتك، ستجد مساحة أكبر لمشاريعك.</p>
        <span className="pricing-status-note">الخطط المدفوعة قيد الإعداد — لا توجد مدفوعات مفعّلة حاليًا.</span>
      </motion.section>
      <motion.section className="pricing-grid" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, amount: .1 }}>
        {plans.map(plan => { const Icon = plan.icon; return <motion.article key={plan.id} className={"pricing-card glass-panel " + (plan.featured ? "featured" : "")} whileHover={{ y: -5 }} transition={{ duration: .2 }}>
          {plan.featured && <span className="pricing-featured-label">الأكثر اختيارًا</span>}
          <div className="pricing-card-icon"><Icon size={20} /></div>
          <h2>{plan.name}</h2><p className="pricing-plan-note">{plan.note}</p>
          <div className="pricing-price">{plan.price}</div><p className="pricing-description">{plan.description}</p>
          <ul>{plan.features.map(feature => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
          <Link className={plan.featured ? "button-primary pricing-action" : "button-secondary pricing-action"} href={plan.href}>{plan.action}<ArrowUpLeft size={15} /></Link>
        </motion.article>; })}
      </motion.section>
      <motion.section className="pricing-footnote glass-panel" variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }}>
        <Infinity size={19} /><div><strong>لا توجد رسوم مخفية.</strong><p>الأسعار وحدود الباقات النهائية ستُعلن عند تفعيل نظام الفوترة. لا يتم تحصيل أي مبلغ من خلال هذه الصفحة.</p></div>
      </motion.section>
    </div>
  );
}
