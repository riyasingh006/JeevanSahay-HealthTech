import * as React from "react";
import { BrainCircuit, HeartPulse, MapPin, Search } from "lucide-react";
import { Reveal } from "./reveal";
import { SectionTitle } from "./why-choose";

const STEPS = [
  {
    num: "01",
    icon: Search,
    tone: "bg-[#3AAA35]",
    title: "Search",
    desc: "Search for hospitals, specialists or healthcare services.",
  },
  {
    num: "02",
    icon: BrainCircuit,
    tone: "bg-[#2563EB]",
    title: "Review options",
    desc: "Compare relevant listings and facility-entered details. AI guidance is not a diagnosis or confirmation of capacity.",
  },
  {
    num: "03",
    icon: MapPin,
    tone: "bg-[#7C6BD6]",
    title: "Plan a route",
    desc: "Open map directions and check the journey with your map provider.",
  },
  {
    num: "04",
    icon: HeartPulse,
    tone: "bg-[#F57C00]",
    title: "Confirm with the provider",
    desc: "Call the facility to confirm services, capacity and appointments before travelling.",
  },
];

function StepArrow() {
  return (
    <span
      aria-hidden
      className="mx-1 hidden shrink-0 items-center lg:flex lg:flex-col"
    >
      <svg width="34" height="10" viewBox="0 0 34 10" fill="none">
        <path
          d="M1 5h29m0 0-4.2-3.4M30 5l-4.2 3.4"
          stroke="#B9C6DA"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-28 bg-[#F6F9FE] py-14 lg:py-16">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionTitle>How Jeevan Sahay Works</SectionTitle>
        </Reveal>

        {/* desktop: horizontal steps with arrows */}
        <div className="mt-11 hidden items-start justify-center lg:flex">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.num}>
              <Reveal delay={i * 90} className="w-[200px] text-center">
                <div className="relative mx-auto flex h-[74px] w-[74px] items-center justify-center">
                  <span className={`flex h-[68px] w-[68px] items-center justify-center rounded-full ${step.tone} shadow-lg`}>
                    <step.icon className="h-8 w-8 text-white" aria-hidden />
                  </span>
                  <span className="absolute -right-2 -top-1 rounded-full bg-white px-1.5 text-[13px] font-extrabold italic text-[#C3CFE0] shadow-sm">
                    {step.num}
                  </span>
                </div>
                <h3 className="mt-4 text-[14.5px] font-bold text-[#061F55]">
                  {step.title}
                </h3>
                <p className="mx-auto mt-1.5 max-w-[190px] text-[12px] leading-[1.6] text-[#52627A]">
                  {step.desc}
                </p>
              </Reveal>
              {i < STEPS.length - 1 && <StepArrow />}
            </React.Fragment>
          ))}
        </div>

        {/* mobile/tablet: vertical timeline */}
        <ol className="relative mt-9 space-y-7 border-l-2 border-dashed border-[#D5E0EF] pl-8 lg:hidden">
          {STEPS.map((step) => (
            <li key={step.num} className="relative">
              <span
                className={`absolute -left-[47px] top-0 flex h-10 w-10 items-center justify-center rounded-full ${step.tone} shadow-md`}
              >
                <step.icon className="h-5 w-5 text-white" aria-hidden />
              </span>
              <span className="text-[12px] font-extrabold italic text-[#A9B8CD]">
                {step.num}
              </span>
              <h3 className="text-[15px] font-bold text-[#061F55]">
                {step.title}
              </h3>
              <p className="mt-1 max-w-md text-[13px] leading-[1.6] text-[#52627A]">
                {step.desc}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
