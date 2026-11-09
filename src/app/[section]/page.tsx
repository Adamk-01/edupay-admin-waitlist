import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { ADMIN_SECTIONS, ENDPOINT_STATE_LABEL, FEATURE_STATUS, OWNER_DECISIONS } from "@/lib/api/features";
import { IS_DEMO } from "@/lib/config";
import { BACKEND_READY, backendReadiness } from "@/lib/api/client";

export const dynamicParams = false;

export function generateStaticParams() {
  return ADMIN_SECTIONS.map((section) => ({ section: section.slug }));
}

/**
 * Real routes for the requested pages, deliberately EMPTY of data.
 * Contract v3: endpoints exist locally but are NOT DEPLOYED and no session
 * solution is approved, so no live figures can be shown anywhere.
 */
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: slug } = await params;
  const section = ADMIN_SECTIONS.find((item) => item.slug === slug);
  if (!section) notFound();

  const status = FEATURE_STATUS[section.feature];

  return <AdminShell active={section.label}>
    <div className="welcome"><div><div className="eyebrow">✦ &nbsp; {ENDPOINT_STATE_LABEL[status.endpointState]}</div><h1>{section.heading}</h1><p>{section.summary}</p></div></div>

    <div className="notice"><ShieldCheck size={19} /><div><b>No live data is shown on this page</b><p>Backend endpoints are implemented locally but not deployed, and the cross-origin session solution has not been approved. Nothing here is estimated, sampled or invented.</p></div><span className="inprogress">NOT CONNECTED</span></div>

    <section className="panel">
      <h3>Why this page is empty</h3>
      <p>{status.reason}</p>
      <div className="milestones" style={{ marginTop: 18 }}>
        <div className="milestone"><i /><div><b>Endpoint state</b><small>{ENDPOINT_STATE_LABEL[status.endpointState]}</small></div></div>
        <div className="milestone"><i /><div><b>Deployed &amp; live-verified</b><small>No — contract v3 says &ldquo;implemented locally, not deployed&rdquo;</small></div></div>
        <div className="milestone"><i /><div><b>Real records behind this feature</b><small>{status.dataSupported ? "Yes — existing waitlist_signups / audit_logs columns" : "No — the required tables or event sources do not exist"}</small></div></div>
        <div className="milestone"><i /><div><b>Client gate</b><small>{BACKEND_READY ? "OPEN" : `CLOSED — ${backendReadiness()}`}</small></div></div>
      </div>
      <h3 style={{ marginTop: 22 }}>What is still needed</h3>
      <div className="milestones">
        {status.requires.map((item) => <div className="milestone" key={item}><i /><div><b>{item}</b></div></div>)}
      </div>
      <p style={{ marginTop: 18 }}>Owner decisions (2026-11-09): {OWNER_DECISIONS.sessionApproach} approved as the approach (not yet built); staging deploy approved (not yet performed);{OWNER_DECISIONS.schemaDeferred ? " campaign/email/consent schema deferred" : " schema work approved"}; no production deployment approved.</p>
      <p style={{ marginTop: 10 }}>{IS_DEMO ? "The Overview page still displays clearly labelled sample data in demo mode. This page never does." : "This environment is in live-data mode; no fabricated figures are displayed anywhere."}</p>
    </section>

    <footer>© 2026 EduPay Africa. Internal workspace. <span><i /> Backend integration pending deployment</span></footer>
  </AdminShell>;
}
