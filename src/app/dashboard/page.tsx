"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  Bookmark,
  BrainCircuit,
  Building2,
  Cross,
  HeartPulse,
  MapPin,
  Phone,
  Search,
  Siren,
  SlidersHorizontal,
  Stethoscope,
} from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { EMERGENCY_HELPLINE } from "@/lib/constants";
import { haversineKm } from "@/lib/utils";
import { loadPatientLocation } from "@/lib/patient/location";
import styles from "./patient-dashboard.module.css";

interface NearbyItem {
  id: string;
  name: string;
  city: string;
  type: string;
  score: number;
  lat?: number | null;
  lng?: number | null;
  icuAvailable: number;
  generalAvailable: number;
  emergencyActive: boolean;
}

interface SavedItem {
  id: string;
  hospital: { id: string; name: string; city: string; type: string };
}

interface SearchItem {
  id: string;
  query: string;
  createdAt: string;
}

interface DashboardData {
  greetingName: string;
  location: string | null;
  cards: { nearbyHospitals: number; emergencyFacilities: number };
  nearby: NearbyItem[];
  recentSearches: SearchItem[];
  saved: SavedItem[];
}

function greetingForNow(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function typeLabel(type: string): string {
  if (type === "GOVERNMENT" || type === "PSU") return "Government";
  if (type === "TRUST") return "Trust / NGO";
  return "Private";
}

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [patientLoc, setPatientLoc] = React.useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);

  React.useEffect(() => {
    const loc = loadPatientLocation();
    if (loc) setPatientLoc({ lat: loc.lat, lng: loc.lng, label: loc.label });
    const endpoint = loc
      ? `/api/dashboard?lat=${encodeURIComponent(loc.lat)}&lng=${encodeURIComponent(loc.lng)}`
      : "/api/dashboard";
    fetch(endpoint, { cache: "no-store", headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setData(json.data as DashboardData);
      })
      .catch(() => {});
  }, []);

  const displayName =
    data?.greetingName ?? user?.name?.trim().split(" ")[0] ?? null;

  const bedsAvailable = React.useMemo(() => {
    if (!data) return 0;
    return data.nearby.reduce(
      (sum, h) => sum + h.icuAvailable + h.generalAvailable,
      0
    );
  }, [data]);

  const stats = data
    ? [
        {
          icon: Building2,
          tone: styles.qaBlue,
          value: String(data.cards.nearbyHospitals),
          label: "Hospital Listings",
          support: "Verified facility profiles",
        },
        {
          icon: BedDouble,
          tone: styles.qaTeal,
          value: String(bedsAvailable),
          label: "Reported Available Beds",
          support: "Facility-reported; call to confirm",
        },
        {
          icon: Siren,
          tone: styles.qaRed,
          value: String(data.cards.emergencyFacilities),
          label: "Facilities with Emergency Services Listed",
          support: "Call to confirm before travelling",
        },
        {
          icon: Bookmark,
          tone: styles.qaPurple,
          value: String(data.saved.length),
          label: "Saved Facilities",
          support: "Save for quick access",
        },
      ]
    : [];

  const quickActions = [
    {
      href: "/dashboard/hospitals",
      title: "Find a Hospital",
      desc: "Nearby hospitals, filters & map",
      Icon: Building2,
      tone: styles.qaBlue,
    },
    {
      href: "/dashboard/doctors",
      title: "Find a Doctor",
      desc: "Search by specialty & city",
      Icon: Stethoscope,
      tone: styles.qaTeal,
    },
    {
      href: "/dashboard/ai-assistant",
      title: "AI Health Assistant",
      desc: "Get navigation guidance",
      Icon: BrainCircuit,
      tone: styles.qaPurple,
    },
    {
      href: "/dashboard/emergency",
      title: "Emergency Care",
      desc: "Find nearest emergency facility",
      Icon: Siren,
      tone: styles.qaRed,
    },
    {
      href: "/dashboard/beds",
      title: "View Reported Bed Counts",
      desc: "Confirm directly with the facility",
      Icon: BedDouble,
      tone: styles.qaPurple,
    },
  ];

  const aiRows = [
    {
      href: "/dashboard/hospitals",
      title: "Compare nearby hospital listings",
      Icon: HeartPulse,
      tone: "#eaf1fe",
      color: "#2563eb",
    },
    {
      href: "/dashboard/emergency",
      title: "Check emergency facilities",
      Icon: Siren,
      tone: "#feecec",
      color: "#dc2626",
    },
    {
      href: "/dashboard/doctors",
      title: "Find a specialist",
      Icon: Stethoscope,
      tone: "#e6f7f8",
      color: "#0f9fa8",
    },
  ];

  return (
    <div className={styles.patientDashboard}>
      <div className={styles.inner}>
        {/* ---------- Welcome hero ---------- */}
        <section className={styles.hero} aria-label="Welcome">
          <div className={styles.heroLeft}>
            <h1 className={styles.greeting}>
              {displayName ? (
                <>
                  Good {greetingForNow()}, {displayName}{" "}
                  <span aria-hidden>👋</span>
                </>
              ) : (
                <>Welcome back 👋</>
              )}
            </h1>
            <p className={styles.heroSub}>
              Your health, simplified with intelligent care navigation.
            </p>
            <p className={styles.heroSupport}>
              Find hospital and doctor listings, facility-reported services, and emergency guidance around you.
            </p>
            <span className={styles.statusPill}>
              <span className={styles.pillDot} aria-hidden />
              Healthcare services available nearby
            </span>
          </div>

          <div className={styles.heroArt} aria-hidden>
            <div className={styles.orbitWrap}>
              <div className={styles.orbitRing} />
              <div className={styles.crossCenter}>
                <Cross style={{ width: 34, height: 34 }} strokeWidth={2.4} />
              </div>
              <span className={`${styles.nodeIcon} ${styles.nodeA}`}>
                <HeartPulse style={{ width: 14, height: 14, color: "#dc2626" }} />
              </span>
              <span className={`${styles.nodeIcon} ${styles.nodeB}`}>
                <Stethoscope style={{ width: 13, height: 13, color: "#0f9fa8" }} />
              </span>
              <span className={`${styles.nodeIcon} ${styles.nodeC}`}>
                <Building2 style={{ width: 13, height: 13, color: "#2563eb" }} />
              </span>
              <span className={`${styles.nodeIcon} ${styles.nodeD}`}>
                <Bookmark style={{ width: 12, height: 12, color: "#7357d8" }} />
              </span>
              <svg
                className={styles.ecgLine}
                width="104"
                height="18"
                viewBox="0 0 104 18"
                fill="none"
              >
                <path
                  d="M2 9 H22 L28 3 L35 15 L41 9 H56 L61 5 L66 13 L71 9 H102"
                  stroke="#2563EB"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </section>

        {/* ---------- Quick actions ---------- */}
        <div className={styles.sectionHead}>
          <div>
            <h2 className={styles.sectionTitle}>
              Quick Actions
              <span className={styles.sectionInline}>
                Access your most used healthcare services
              </span>
            </h2>
          </div>
          <button
            type="button"
            className={styles.customizeBtn}
            title="Layout customization coming soon"
            disabled
          >
            Customize <SlidersHorizontal style={{ width: 11, height: 11 }} />
          </button>
        </div>

        <nav className={styles.qaGrid} aria-label="Quick actions">
          {quickActions.map((a) => (
            <Link key={a.title} href={a.href} className={styles.qaCard}>
              <span className={`${styles.qaIcon} ${a.tone}`}>
                <a.Icon style={{ width: 18, height: 18 }} aria-hidden />
              </span>
              <span className={styles.qaText}>
                <span className={styles.qaTitle}>{a.title}</span>
                <br />
                <span className={styles.qaDesc}>{a.desc}</span>
              </span>
              <span className={styles.qaArrow} aria-hidden>
                <ArrowRight style={{ width: 10, height: 10 }} />
              </span>
            </Link>
          ))}
        </nav>

        {/* ---------- Statistics ---------- */}
        {!data ? (
          <div className={styles.statGrid} aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`${styles.skelBlock} ${styles.statCard}`} />
            ))}
          </div>
        ) : (
          <>
            <section className={styles.statGrid} aria-label="Statistics">
              {stats.map((s) => (
                <div key={s.label} className={styles.statCard}>
                  <span className={`${styles.qaIcon} ${s.tone}`}>
                    <s.icon style={{ width: 18, height: 18 }} aria-hidden />
                  </span>
                  <div>
                    <div className={styles.statValue}>{s.value}</div>
                    <div className={styles.statLabel}>{s.label}</div>
                    <div className={styles.statSupport}>{s.support}</div>
                  </div>
                </div>
              ))}
            </section>
            <p className={styles.demoNote}>
              Availability figures come from the Jeevan Sahay sample dataset
              maintained manually — verify by phone before travelling.
            </p>
          </>
        )}

        {/* ---------- Main 3-column grid ---------- */}
        <div className={styles.mainGrid}>
          {/* Left — Nearby healthcare facilities */}
          <section className={styles.panel} aria-label="Nearby healthcare facilities">
            <div className={styles.panelHead}>
              <div>
                <h3 className={styles.panelTitle}>Nearby Healthcare Facilities</h3>
                <p className={styles.panelSub}>Ranked by suitability</p>
                <p className={styles.locRow}>
                  <MapPin style={{ width: 11, height: 11, color: "#0f9fa8" }} aria-hidden />
                  {patientLoc
                    ? `Using: ${patientLoc.label}`
                    : "New Delhi (default centre; share a location to personalise)"}
                </p>
              </div>
              <div className={styles.headActions}>
                <Link href="/dashboard/hospitals" className={styles.miniBtn}>
                  Filter
                </Link>
                <Link
                  href="/dashboard/hospitals"
                  className={styles.miniBtn}
                >
                  View Map
                </Link>
              </div>
            </div>

            {!data ? (
              <div className={styles.rows}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`${styles.skelBlock} ${styles.hRow}`}
                    style={{ borderRadius: 10 }}
                  />
                ))}
              </div>
            ) : (
              <>
                <div className={styles.rows}>
                  {data.nearby.slice(0, 3).map((h) => {
                    const km =
                      patientLoc && h.lat != null && h.lng != null
                        ? haversineKm(patientLoc, { lat: h.lat, lng: h.lng })
                        : null;
                    return (
                      <div key={h.id} className={styles.hRow}>
                        <span className={styles.hThumb} aria-hidden>
                          <Cross style={{ width: 17, height: 17 }} />
                        </span>
                        <div className={styles.hMain}>
                          <div className={styles.hName}>{h.name}</div>
                          <div className={styles.hMetaRow}>
                            <span className={styles.hMeta}>
                              {h.city} · {typeLabel(h.type)}
                              {km != null ? ` · ${km.toFixed(1)} km` : ""}
                            </span>
                            <span className={styles.badgeRow}>
                              {h.emergencyActive && (
                                <span className={`${styles.miniBadge} ${styles.bRed}`}>
                                  Emergency Active
                                </span>
                              )}
                              <span className={`${styles.miniBadge} ${styles.bBlue}`}>
                                ICU {h.icuAvailable}
                              </span>
                              <span className={`${styles.miniBadge} ${styles.bGreen}`}>
                                General {h.generalAvailable}
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className={styles.hSide}>
                          <span className={styles.matchBadge}>
                            {h.score}% Match
                          </span>
                          <Link
                            href={`/dashboard/hospitals/${h.id}`}
                            className={styles.viewDetailsLink}
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Link href="/dashboard/hospitals" className={styles.viewAll}>
                  View all hospitals →
                </Link>
              </>
            )}
          </section>

          {/* Center — AI Health Navigator */}
          <section className={styles.aiCard} aria-label="AI Health Navigator">
            <div className={styles.aiTitleRow}>
              <h3 className={styles.panelTitle}>
                AI Health Navigator
              </h3>
              <span className={styles.aiBeta}>BETA</span>
            </div>
            <p className={styles.aiSub}>
              Smart guidance for your next healthcare decision.
            </p>

            <div className={styles.aiVisual} aria-hidden>
              <span className={styles.ring2} />
              <span className={styles.ring1} />
              <span className={styles.dot + " " + styles.d1} />
              <span className={styles.dot + " " + styles.d2} />
              <span className={styles.dot + " " + styles.d3} />
              <span className={styles.dot + " " + styles.d4} />
              <span className={styles.aiBrain}>
                <BrainCircuit style={{ width: 30, height: 30 }} />
              </span>
            </div>

            <div className={styles.aiRows}>
              {aiRows.map((r) => (
                <Link key={r.title} href={r.href} className={styles.aiRow}>
                  <span
                    className={styles.aiRowIcon}
                    style={{ background: r.tone, color: r.color }}
                  >
                    <r.Icon style={{ width: 13, height: 13 }} aria-hidden />
                  </span>
                  {r.title}
                  <ArrowRight
                    className={styles.aiRowArrow}
                    style={{ width: 13, height: 13 }}
                    aria-hidden
                  />
                </Link>
              ))}
            </div>

            <Link href="/dashboard/ai-assistant" className={styles.aiCta}>
              Ask AI Assistant →
            </Link>
          </section>

          {/* Right — Recent searches + saved facilities */}
          <div className={styles.rightCol}>
            <section className={styles.panel} aria-label="Recent searches">
              <div className={styles.panelHead}>
                <h3 className={styles.panelTitle}>
                  <Search style={{ width: 13, height: 13, color: "#506582" }} aria-hidden />
                  Recent Searches
                </h3>
              </div>

              {!data ? (
                <div className={styles.searchList}>
                  <div className={`${styles.skelBlock} ${styles.sRow}`} style={{ borderRadius: 9 }} />
                  <div className={`${styles.skelBlock} ${styles.sRow}`} style={{ borderRadius: 9 }} />
                </div>
              ) : data.recentSearches.length > 0 ? (
                <div className={styles.searchList}>
                  {data.recentSearches.slice(0, 4).map((s) => (
                    <Link
                      key={s.id}
                      href={`/dashboard/hospitals?q=${encodeURIComponent(s.query)}`}
                      className={styles.sRow}
                    >
                      <Search
                        style={{ width: 12, height: 12, color: "#94a5c0", flexShrink: 0 }}
                        aria-hidden
                      />
                      <span className={styles.sQuery}>{s.query}</span>
                      <ArrowRight
                        style={{ width: 11, height: 11, color: "#b7c4d8", flexShrink: 0 }}
                        aria-hidden
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <span className={styles.emptyCircle}>
                    <Search style={{ width: 20, height: 20 }} aria-hidden />
                  </span>
                  <p className={styles.emptyTitle}>
                    Your healthcare journey starts here.
                  </p>
                  <p className={styles.emptyDesc}>
                    Search for hospitals, doctors, specialists or healthcare
                    services and they will appear here.
                  </p>
                  <Link href="/dashboard/hospitals" className={styles.emptyBtn}>
                    Find a Hospital
                  </Link>
                </div>
              )}
            </section>

            <section className={styles.panel} aria-label="Saved healthcare facilities">
              <div className={styles.panelHead}>
                <h3 className={styles.panelTitle}>
                  <Bookmark style={{ width: 13, height: 13, color: "#506582" }} aria-hidden />
                  Saved Healthcare Facilities
                </h3>
                <Link href="/dashboard/saved" className={styles.viewDetailsLink}>
                  View All
                </Link>
              </div>

              {!data ? (
                <div className={styles.savedList}>
                  <div className={`${styles.skelBlock} ${styles.savedRow}`} style={{ borderRadius: 9 }} />
                </div>
              ) : data.saved.length > 0 ? (
                <div className={styles.savedList}>
                  {data.saved.slice(0, 3).map((s) => (
                    <Link
                      key={s.id}
                      href={`/dashboard/hospitals/${s.hospital.id}`}
                      className={styles.savedRow}
                    >
                      <span className={styles.savedThumb} aria-hidden>
                        <Building2 style={{ width: 14, height: 14 }} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span className={styles.savedName}>{s.hospital.name}</span>
                        <br />
                        <span className={styles.savedCity}>
                          {s.hospital.city} · {typeLabel(s.hospital.type)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <span className={styles.emptyCircle}>
                    <Bookmark style={{ width: 20, height: 20 }} aria-hidden />
                  </span>
                  <p className={styles.emptyDesc}>
                    Save hospitals and healthcare facilities for quick access.
                  </p>
                  <Link href="/dashboard/hospitals" className={styles.emptyBtn}>
                    Explore Hospitals
                  </Link>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* ---------- Emergency banner ---------- */}
        <section className={styles.emergBanner} aria-label="Emergency care">
          <div className={styles.emergLeft}>
            <span className={styles.emergIcon}>
              <Siren style={{ width: 19, height: 19 }} aria-hidden />
            </span>
            <div>
              <p className={styles.emergTitle}>Need Emergency Care?</p>
              <p className={styles.emergSub}>
                Browse nearby emergency-facility listings; call the facility to confirm capacity.
              </p>
            </div>
          </div>
          <div className={styles.emergActions}>
            <Link href="/dashboard/emergency" className={`${styles.emergBtn} ${styles.emergPrimary}`}>
              <Siren style={{ width: 13, height: 13 }} aria-hidden />
              Emergency Care
            </Link>
            <a
              href={`tel:${EMERGENCY_HELPLINE}`}
              className={`${styles.emergBtn} ${styles.emergGhost}`}
            >
              <Phone style={{ width: 13, height: 13 }} aria-hidden />
              Call {EMERGENCY_HELPLINE}
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
