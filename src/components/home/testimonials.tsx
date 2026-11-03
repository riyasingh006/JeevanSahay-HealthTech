import { ClipboardCheck, MapPin, PhoneCall } from "lucide-react";
import { Reveal } from "./reveal";
import { SectionTitle } from "./why-choose";

const GUIDANCE = [
  {
    title: "Search your area",
    description: "Browse facility listings by location and care type. Results show whether they come from Google Places or hospital records.",
    icon: MapPin,
    tone: "bg-[#EAF3FF] text-[#0B3D91]",
  },
  {
    title: "Check reported details",
    description: "Bed, service and doctor information may be entered by a facility and can change. It is not a live capacity feed.",
    icon: ClipboardCheck,
    tone: "bg-[#EAF7E8] text-[#2E9429]",
  },
  {
    title: "Confirm directly",
    description: "Call the facility before travelling. Appointment requests are not confirmed until the hospital responds.",
    icon: PhoneCall,
    tone: "bg-[#FFF0DF] text-[#C05F00]",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="scroll-mt-28 bg-white py-14 lg:py-16">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionTitle>Using hospital information</SectionTitle>
        </Reveal>

        <div className="mt-9 grid gap-6 md:grid-cols-3 lg:grid-cols-3">
          {GUIDANCE.map(({ title, description, icon: Icon, tone }, index) => (
            <Reveal key={title} delay={index * 90}>
              <article className="flex h-full min-h-[140px] w-full flex-col rounded-[9px] border border-[#EDF1F7] bg-white p-5 shadow-[0_12px_30px_-20px_rgba(6,31,85,0.3)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_38px_-20px_rgba(6,31,85,0.4)]">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${tone}`} aria-hidden>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-[13px] font-bold text-[#061F55]">{title}</h3>
                <p className="mt-1.5 flex-1 text-[12.5px] leading-[1.65] text-[#52627A]">{description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
