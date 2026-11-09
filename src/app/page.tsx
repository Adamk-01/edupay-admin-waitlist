"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { IS_DEMO } from "@/lib/config";
import { AdminShell } from "@/components/admin-shell";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Clock3, Filter, MapPin, Search, Send, ShieldCheck, School, Users, UserRoundCheck } from "lucide-react";

const people = [
  {name:"Amara Okafor",email:"amara.okafor@email.com",type:"Student",state:"Lagos",status:"Verified",date:"Nov 09, 2026",initials:"AO"},
  {name:"Daniel Ibrahim",email:"daniel.ibrahim@email.com",type:"Parent / Guardian",state:"Abuja",status:"Verified",date:"Nov 09, 2026",initials:"DI"},
  {name:"Bright Future Academy",email:"admin@brightfuture.edu.ng",type:"Institution",state:"Ogun",status:"Pending",date:"Nov 08, 2026",initials:"BF"},
  {name:"Zainab Musa",email:"zainab.musa@email.com",type:"Student",state:"Kano",status:"Verified",date:"Nov 08, 2026",initials:"ZM"},
  {name:"Emeka Nwosu",email:"emeka.nwosu@email.com",type:"Student",state:"Enugu",status:"Pending",date:"Nov 07, 2026",initials:"EN"},
];
const bars=[30,43,37,56,48,68,53,74,61,84,70,93,77,100,83,91,72,86,66,95,78,89,73,98];

export default function Home() {
 const [query,setQuery]=useState("");
 const filtered=useMemo(()=>people.filter(p=>`${p.name} ${p.email} ${p.type} ${p.state}`.toLowerCase().includes(query.toLowerCase())),[query]);
 return <AdminShell active="Overview">
   <div className="welcome"><div><div className="eyebrow">✦ &nbsp; {IS_DEMO?"DEMO PREVIEW — NOT CONNECTED":"LIVE DATA UNAVAILABLE"}</div><h1>Your launch, at a glance.</h1><p>A clear view of the people getting ready for EduPay.</p></div><div className="actions"><Link className="secondary" href="/registrations"><Users size={15}/> View registrations</Link><Link className="primary" href="/campaigns"><Send size={15}/> New campaign</Link></div></div>
    <div className="notice"><ShieldCheck size={19}/><div><b>{IS_DEMO?"Preview workspace — illustrative data only":"Backend integration not complete"}</b><p>{IS_DEMO?"Every figure, chart and row below is sample data. No live waitlist records, staff authentication, email activity or campaigns are connected.":"No live waitlist data can be shown until the owner-protected backend API is verified and connected."}</p></div><span className="inprogress">NOT CONNECTED</span></div>
    {IS_DEMO?(<>
    <div className="sectionhead"><div><h2>Waitlist overview</h2><p>Track signups and verification progress.</p></div><button className="period"><CalendarDays size={14}/> Last 30 days <ChevronDown size={14}/></button></div>
    <div className="stats">
     <Stat title="Total registrations" value="2,450" change="+18.6%" detail="vs. previous period" icon={<Users/>} tone="navy"/>
     <Stat title="Verified registrations" value="1,890" change="+12.4%" detail="77.1% of total signups" icon={<UserRoundCheck/>} tone="green"/>
     <Stat title="Awaiting verification" value="560" change="22.9%" detail="of total registrations" icon={<Clock3/>} tone="amber"/>
     <Stat title="Institutions" value="184" change="+8.2%" detail="vs. previous period" icon={<School/>} tone="orange"/>
    </div>
    <div className="twocol">
     <section className="panel"><PanelHead title="Registration growth" subtitle="Signups over the selected period"/><div className="chartsummary"><strong>2,450</strong><span>↗ 18.6%</span><small>registrations</small></div><div className="chart"><div className="axis"><span>2,500</span><span>1,875</span><span>1,250</span><span>625</span><span>0</span></div><div className="plot"><div className="gridlines"><i/><i/><i/><i/><i/></div><div className="bars">{bars.map((h,i)=><i key={i} className={i>18?"hot":""} style={{height:`${h}%`}}/>)}</div><div className="dates"><span>Oct 12</span><span>Oct 19</span><span>Oct 26</span><span>Nov 02</span><span>Nov 09</span></div></div></div></section>
     <section className="panel"><PanelHead title="Audience breakdown" subtitle="Who is joining the waitlist"/><div className="donutbox"><div className="donut"><div><b>2,450</b><small>Total people</small></div></div></div><div className="legend"><Legend color="orange" label="Students" value="1,421" percent="58%"/><Legend color="navy" label="Parents / Guardians" value="698" percent="28%"/><Legend color="green" label="Institutions" value="331" percent="14%"/></div></section>
    </div>
    <div className="twocol lower">
     <section className="panel"><div className="panelhead"><PanelHead title="Recent registrations" subtitle="The latest people joining EduPay"/><Link className="viewall" href="/registrations">View all <ChevronRight size={14}/></Link></div><div className="tools"><div className="search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search registrations"/></div><button className="filter"><Filter size={14}/> Filters</button></div><div className="tablewrap"><table><thead><tr><th>NAME</th><th>AUDIENCE</th><th>LOCATION</th><th>STATUS</th><th>DATE JOINED</th></tr></thead><tbody>{filtered.map(p=><tr key={p.email}><td><div className="person"><div className="personavatar">{p.initials}</div><div><b>{p.name}</b><small>{p.email}</small></div></div></td><td>{p.type}</td><td><span className="location"><MapPin size={11}/>{p.state}</span></td><td><span className={`status ${p.status==="Verified"?"verified":"pending"}`}>{p.status}</span></td><td>{p.date}</td></tr>)}</tbody></table>{filtered.length===0&&<div className="empty">No matching sample registrations.</div>}</div><div className="tablefoot">Showing {filtered.length} of 5 sample records <span>‹ &nbsp; 1 &nbsp; ›</span></div></section>
     <section className="panel"><div className="panelhead"><PanelHead title="Launch readiness" subtitle="Key setup milestones"/><span className="inprogress">IN PROGRESS</span></div><div className="readiness"><strong>2<span>/5</span></strong><small>milestones complete</small><div className="progress"><i/></div></div><div className="milestones"><Milestone done title="Waitlist website live" detail="Public registration is available"/><Milestone done title="Email verification" detail="Verification flow connected"/><Milestone title="Admin dashboard" detail="Building the management workspace"/><Milestone title="Campaign management" detail="Email audience and sending controls"/><Milestone title="Launch review" detail="Final security and privacy checks"/></div><Link className="setup" href="/settings">View project setup <ChevronRight size={14}/></Link></section>
    </div><footer>© 2026 EduPay Africa. Internal workspace. <span><i/> All systems shown are demo-only</span></footer>
    </>):(<UnavailableState/>)}
  </AdminShell>;
}
function Stat({title,value,change,detail,icon,tone}:{title:string;value:string;change:string;detail:string;icon:React.ReactNode;tone:string}){return <div className="stat"><div className="stattop"><span>{title}</span><i className={tone}>{icon}</i></div><strong>{value}</strong><div className="statfoot"><b>↗ {change}</b><span>{detail}</span></div></div>}
function PanelHead({title,subtitle}:{title:string;subtitle:string}){return <div><h3>{title}</h3><p>{subtitle}</p></div>}
function Legend({color,label,value,percent}:{color:string;label:string;value:string;percent:string}){return <div className="legendrow"><i className={color}/><span>{label}</span><b>{value}</b><small>{percent}</small></div>}
function Milestone({done=false,title,detail}:{done?:boolean;title:string;detail:string}){return <div className="milestone"><i className={done?"complete":""}>{done?<CheckCircle2 size={14}/>:null}</i><div><b>{title}</b><small>{detail}</small></div></div>}

function UnavailableState(){return <section className="panel"><h3>Live data is not available yet</h3><p>This environment is not connected to the owner-protected EduPay backend. No registration figures, analytics, campaigns, email activity or exports are displayed until that integration has been verified and implemented.</p><p>Nothing on this page is invented. Data will appear here only when it can be read from real database records through an authenticated, owner-only API.</p></section>}
