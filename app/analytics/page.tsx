import type { Metadata } from "next";
import AnalyticsDashboard from "@/components/analytics/analytics-dashboard";
export const metadata: Metadata = { title: "مركز التحليلات" };
export default function AnalyticsPage() { return <AnalyticsDashboard />; }
