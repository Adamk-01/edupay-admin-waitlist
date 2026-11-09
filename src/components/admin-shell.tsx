"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity, Bell, ChevronDown, Download, GraduationCap, LayoutDashboard,
  Mail, Menu, MoreHorizontal, Send, Settings, Users, X
} from "lucide-react";
import { IS_DEMO } from "@/lib/config";

/** Real routes — no `setActive` state pretending a page changed. */
const nav = [
  { group: "WORKSPACE", items: [["Overview", "/", LayoutDashboard], ["Registrations", "/registrations", Users], ["Analytics", "/analytics", Activity]] },
  { group: "COMMUNICATION", items: [["Launch campaigns", "/campaigns", Send], ["Email activity", "/email-activity", Mail]] },
  { group: "MANAGEMENT", items: [["Exports", "/exports", Download], ["Settings", "/settings", Settings]] }
] as const;

export function AdminShell({ active, children }: { active: string; children: ReactNode }) {
  const [mobile, setMobile] = useState(false);

  return <main className="shell">
    {mobile && <button className="scrim" onClick={() => setMobile(false)} aria-label="Close menu" />}
    <aside className={`sidebar ${mobile ? "open" : ""}`}>
      <div className="brand"><div className="brandmark"><GraduationCap size={23} /></div><div><b>EduPay<span>.</span></b><small>WAITLIST CONTROL</small></div><button className="close" onClick={() => setMobile(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <label className="muted-label">YOUR WORKSPACE</label><div className="workspace"><div className="workspace-icon">W</div><div><b>EduPay Waitlist</b><small>Launch workspace</small></div><ChevronDown size={15} /></div>
      <nav>{nav.map(group => <div className="navgroup" key={group.group}><label className="muted-label">{group.group}</label>{group.items.map(([label, href, Icon]) => <Link key={label} href={href} className={`navitem ${active === label ? "selected" : ""}`} aria-current={active === label ? "page" : undefined} onClick={() => setMobile(false)}><Icon size={17} />{label}</Link>)}</div>)}</nav>
      <div className="sidebottom"><div className="help"><b>Need a hand?</b><p>Find guidance for managing your waitlist.</p><span>Visit help centre ↗</span></div><div className="account"><div className="avatar">RA</div><div><b>Waitlist Owner</b><small>Administrator</small></div><MoreHorizontal size={18} /></div></div>
    </aside>
    <section className="main">
      <header className="topbar"><button className="hamb" onClick={() => setMobile(true)} aria-label="Open navigation" aria-expanded={mobile}><Menu /></button><div className="crumb">EduPay Waitlist <span>/</span> <b>{active}</b></div><div className="topright"><span className="demo"><i /> {IS_DEMO ? "DEMO · NO BACKEND" : "NOT CONNECTED"}</span><button className="bell" aria-label="Notifications"><Bell size={18} /></button><div className="avatar">RA</div></div></header>
      <div className="content">{children}</div>
    </section>
  </main>;
}
