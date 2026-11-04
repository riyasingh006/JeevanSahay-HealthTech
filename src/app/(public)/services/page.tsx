import Link from "next/link";
import { Activity, Ambulance, Droplets, FlaskConical, HeartPulse, Pill, ScanLine, ScanSearch, Siren, Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { FacilityReportedNotice } from "@/components/ui/data-source";
import { SERVICE_CATALOG } from "@/lib/constants";

const icons = { siren: Siren, activity: Activity, ambulance: Ambulance, droplets: Droplets, pill: Pill, "flask-conical": FlaskConical, "scan-line": ScanLine, scan: ScanSearch, "heart-pulse": HeartPulse, stethoscope: Stethoscope };

export default function ServicesPage() {
  return <><PageHeader title="Healthcare services" subtitle="Browse service categories and find verified facilities that report offering them." breadcrumb={[{ label: "Home", href: "/" }, { label: "Healthcare services" }]} /><div className="container space-y-5 py-6"><FacilityReportedNotice /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{SERVICE_CATALOG.map((service) => { const Icon = icons[service.icon]; return <Link key={service.key} href={`/hospitals?service=${encodeURIComponent(service.key)}`} className="group"><Card className="h-full transition hover:-translate-y-0.5 hover:border-care-300 hover:shadow-raised"><CardContent className="flex items-start gap-4 pt-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><Icon className="h-5 w-5" aria-hidden /></span><span><span className="font-semibold text-primary-950 group-hover:text-primary-700">{service.label}</span><span className="mt-1 block text-sm text-slate-600">See facilities reporting this service.</span></span></CardContent></Card></Link>; })}</div><p className="text-xs leading-relaxed text-slate-500">Hospital service listings are not independently verified beyond hospital account verification and may be out of date. Call the facility to confirm.</p></div></>;
}
