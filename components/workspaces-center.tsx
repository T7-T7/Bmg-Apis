"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
import styles from "./workspaces-center.module.css";
import OrganizationUsagePanel from "./organization-usage-panel";

type Organization={id:string;name:string;kind:"individual"|"organization"|"company";owner_id:string;created_at:string;is_default_workspace:boolean};
type Project={id:string;organization_id:string;name:string;slug:string;description:string;created_at:string};
type Member={user_id:string;email:string|null;display_name:string|null;role:"owner"|"admin"|"developer"|"viewer";created_at:string};
type Invitation={id:string;email:string;role:"admin"|"developer"|"viewer";project_id:string|null;expires_at:string;created_at:string};

export default function WorkspacesCenter(){
 const [db]=useState(()=>{try{return getSupabaseBrowserClient()}catch{return null}});
 const [userId,setUserId]=useState("");
 const [organizations,setOrganizations]=useState<Organization[]>([]);
 const [selectedOrgId,setSelectedOrgId]=useState("");
 const [projects,setProjects]=useState<Project[]>([]);
 const [members,setMembers]=useState<Member[]>([]);
 const [invitations,setInvitations]=useState<Invitation[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [orgName,setOrgName]=useState("");
 const [orgKind,setOrgKind]=useState<Organization["kind"]>("company");
 const [projectName,setProjectName]=useState("");
 const [projectDescription,setProjectDescription]=useState("");
 const [inviteEmail,setInviteEmail]=useState("");
 const [inviteRole,setInviteRole]=useState<Invitation["role"]>("developer");
 const [inviteProject,setInviteProject]=useState("");
 const [myRole,setMyRole]=useState<Member["role"]|"">("");
 const [activeWorkspaceTab,setActiveWorkspaceTab]=useState<"overview"|"usage">("overview");

 const selectedOrg=useMemo(()=>organizations.find(x=>x.id===selectedOrgId)||null,[organizations,selectedOrgId]);
 useEffect(()=>{setActiveWorkspaceTab("overview")},[selectedOrgId]);
 const loadOrganizations=useCallback(async()=>{
  if(!db)return;
  const {data,error}=await db.from("organizations").select("id,name,kind,owner_id,created_at,is_default_workspace").order("created_at",{ascending:true});
  if(error){setError("تعذر تحميل مساحات العمل: "+error.message);return}
  const list=(data||[]) as Organization[];
  setOrganizations(list);
  if(!selectedOrgId&&list.length)setSelectedOrgId(list[0].id);
 },[db,selectedOrgId]);
 const loadDetails=useCallback(async()=>{
  if(!db||!selectedOrgId||!userId)return;
  setLoading(true);setError("");
  const [projectResult,memberResult,inviteResult,myMembership]=await Promise.all([
   db.from("projects").select("id,organization_id,name,slug,description,created_at").eq("organization_id",selectedOrgId).order("created_at",{ascending:true}),
   db.rpc("bmg_list_organization_members",{p_organization_id:selectedOrgId}),
   db.from("organization_invitations").select("id,email,role,project_id,expires_at,created_at").eq("organization_id",selectedOrgId).is("accepted_at",null).is("declined_at",null).is("revoked_at",null).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}),
   db.from("organization_members").select("role").eq("organization_id",selectedOrgId).eq("user_id",userId).maybeSingle()
  ]);
  if(projectResult.error)setError("تعذر تحميل المشاريع: "+projectResult.error.message);else setProjects((projectResult.data||[]) as Project[]);
  if(memberResult.error)setError(current=>current?current+" · تعذر تحميل الأعضاء: "+memberResult.error.message:"تعذر تحميل الأعضاء: "+memberResult.error.message);else setMembers((memberResult.data||[]) as Member[]);
  if(inviteResult.error)setError(current=>current?current+" · تعذر تحميل الدعوات: "+inviteResult.error.message:"تعذر تحميل الدعوات: "+inviteResult.error.message);else setInvitations((inviteResult.data||[]) as Invitation[]);
  setMyRole((myMembership.data?.role||"") as Member["role"]|"");
  setLoading(false);
 },[db,selectedOrgId,userId]);
 useEffect(()=>{let alive=true;if(!db){setError("إعدادات الاتصال بقاعدة البيانات غير مكتملة.");setLoading(false);return}void db.auth.getUser().then(async({data,error})=>{if(!alive)return;if(error||!data.user){window.location.assign("/login");return}setUserId(data.user.id);const {data:orgs,error:orgError}=await db.from("organizations").select("id,name,kind,owner_id,created_at,is_default_workspace").order("created_at",{ascending:true});if(!alive)return;if(orgError)setError(orgError.message);else{const list=(orgs||[]) as Organization[];setOrganizations(list);if(list.length)setSelectedOrgId(list[0].id)}setLoading(false)});return()=>{alive=false}},[db]);
 useEffect(()=>{if(!selectedOrgId||!userId)return;const frame=window.requestAnimationFrame(()=>{void loadDetails()});return()=>window.cancelAnimationFrame(frame)},[selectedOrgId,userId,loadDetails]);

 async function createOrganization(){if(!db||busy)return;if(orgName.trim().length<2){setError("اكتب اسمًا لا يقل عن حرفين.");return}setBusy(true);setError("");setNotice("");const {data,error}=await db.rpc("bmg_create_organization",{p_name:orgName.trim(),p_kind:orgKind});if(error)setError("تعذر إنشاء مساحة العمل: "+error.message);else{setOrgName("");setNotice("تم إنشاء مساحة العمل ومشروعها الافتراضي.");const {data:orgs}=await db.from("organizations").select("id,name,kind,owner_id,created_at,is_default_workspace").order("created_at",{ascending:true});setOrganizations((orgs||[]) as Organization[]);if(data)setSelectedOrgId(String(data))}setBusy(false)}
 async function createProject(){if(!db||busy||!selectedOrgId)return;if(projectName.trim().length<2){setError("اكتب اسمًا للمشروع لا يقل عن حرفين.");return}setBusy(true);setError("");setNotice("");const {error}=await db.rpc("bmg_create_project",{p_organization_id:selectedOrgId,p_name:projectName.trim(),p_description:projectDescription.trim()});if(error)setError("تعذر إنشاء المشروع: "+error.message);else{setProjectName("");setProjectDescription("");setNotice("تم إنشاء المشروع.");await loadDetails()}setBusy(false)}
 async function inviteMember(){if(!db||busy||!selectedOrgId)return;if(!inviteEmail.trim()){setError("أدخل بريد الحساب الذي تريد دعوته.");return}if(inviteProject&&inviteRole==="admin"){setError("دور مدير المؤسسة لا يمكن منحه لدعوة مشروع محدد.");return}setBusy(true);setError("");setNotice("");const {error}=await db.rpc("bmg_invite_organization_member",{p_organization_id:selectedOrgId,p_email:inviteEmail.trim().toLowerCase(),p_role:inviteRole,p_project_id:inviteProject||null});if(error)setError(error.message.includes("No registered account")?"لم نعثر على حساب مسجل بهذا البريد. يجب أن يكون العضو قد أنشأ حسابًا في المنصة أولًا.": "تعذر إنشاء الدعوة: "+error.message);else{setInviteEmail("");setNotice("تم إنشاء الدعوة وإرسال إشعار إلى البريد الوارد للحساب المستهدف.");await loadDetails()}setBusy(false)}
 const roleLabel=(role:string)=>({owner:"المالك",admin:"مدير",developer:"مطور",viewer:"مشاهد"}[role]||role);
 const kindLabel=(org:Organization)=>org.is_default_workspace?"المساحة الشخصية الافتراضية":org.kind==="individual"?"مساحة شخصية إضافية":org.kind==="company"?"شركة":"مؤسسة";
 return <section className={styles.page} dir="rtl">
  <header className={styles.header}><div><span>WORKSPACES & PROJECTS</span><h1>المؤسسات والمشاريع</h1><p>أنشئ مساحات عمل، ونظّم المشاريع، وأدر وصول أعضاء فريقك.</p></div><button onClick={()=>{void loadOrganizations();void loadDetails()}} disabled={busy||loading}>تحديث</button></header>
  {error&&<div className={styles.error}>{error}</div>}{notice&&<div className={styles.notice}>{notice}</div>}
  <section className={styles.createOrg}>
   <div><h2>إنشاء مساحة عمل</h2><p>يمكنك إنشاء مساحة شخصية إضافية أو مؤسسة أو شركة لإدارة تطبيقاتك وفريقك.</p></div>
   <div className={styles.orgForm}><input value={orgName} onChange={e=>setOrgName(e.target.value)} maxLength={100} placeholder="اسم المؤسسة أو الشركة"/><select value={orgKind} onChange={e=>setOrgKind(e.target.value as Organization["kind"])}><option value="individual">فردي</option><option value="organization">مؤسسة</option><option value="company">شركة</option></select><button disabled={busy||orgName.trim().length<2} onClick={()=>void createOrganization()}>{busy?"جارٍ الإنشاء…":"إنشاء"}</button></div>
  </section>
  <section className={styles.workspaceSection}>
   <div className={styles.sectionTitle}><div><h2>مساحات العمل الخاصة بك</h2><p>اختر المساحة التي تريد إدارة مشاريعها وأعضائها.</p></div><span>{organizations.length} مساحة</span></div>
   {loading&&!organizations.length?<div className={styles.empty}>جارٍ تحميل مساحات العمل…</div>:organizations.length?<div className={styles.orgGrid}>{organizations.map(org=><button key={org.id} className={selectedOrgId===org.id?styles.orgSelected:styles.orgCard} onClick={()=>setSelectedOrgId(org.id)}><span>{kindLabel(org)}</span><b>{org.name}</b><small>{org.owner_id===userId?"أنت المالك":"عضو في المساحة"}</small></button>)}</div>:<div className={styles.empty}>لم يتم العثور على مساحة عمل. أعد تحميل الصفحة.</div>}
  </section>
  {selectedOrg&&<section className={styles.workspaceDetails}>
   <div className={styles.selectedHeader}><div><span>{kindLabel(selectedOrg)}</span><h2>{selectedOrg.name}</h2><p>دورك في هذه المساحة: <b>{roleLabel(myRole||"غير محدد")}</b></p></div><span className={styles.memberCount}>{members.length} أعضاء</span></div>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"12px 0"}}>
    <button type="button" aria-pressed={activeWorkspaceTab==="overview"} onClick={()=>setActiveWorkspaceTab("overview")} style={{padding:"9px 13px",borderRadius:9,border:"1px solid var(--border,#444)",background:activeWorkspaceTab==="overview"?"var(--accent,#7046d8)":"transparent",color:activeWorkspaceTab==="overview"?"#fff":"inherit"}}>المشاريع والأعضاء</button>
    <button type="button" aria-pressed={activeWorkspaceTab==="usage"} disabled={selectedOrg.is_default_workspace} onClick={()=>setActiveWorkspaceTab("usage")} style={{padding:"9px 13px",borderRadius:9,border:"1px solid var(--border,#444)",background:activeWorkspaceTab==="usage"?"var(--accent,#7046d8)":"transparent",color:activeWorkspaceTab==="usage"?"#fff":"inherit",opacity:selectedOrg.is_default_workspace ? 0.5 : 1}}>الاستهلاك والطلبات المتبقية</button>
    {selectedOrg.is_default_workspace&&<small style={{alignSelf:"center",opacity:.7}}>استهلاك المساحة الافتراضية يظهر في صفحة استهلاك الحساب.</small>}
   </div>
   {activeWorkspaceTab==="usage"?<OrganizationUsagePanel organizationId={selectedOrg.id}/>:<>
   <div className={styles.columns}>
    <section className={styles.panel}><div className={styles.sectionTitle}><div><h3>المشاريع</h3><p>كل مشروع مساحة مستقلة للمفاتيح والاستخدام.</p></div><span>{projects.length}</span></div>
     {projects.map(project=><article className={styles.project} key={project.id}><div><b>{project.name}</b><code>{project.slug}</code></div><p>{project.description||"لا يوجد وصف للمشروع."}</p></article>)}
     {!projects.length&&!loading&&<p className={styles.muted}>لا توجد مشاريع بعد.</p>}
     {["owner","admin","developer"].includes(myRole)&&<div className={styles.formBlock}><h4>إنشاء مشروع</h4><input value={projectName} onChange={e=>setProjectName(e.target.value)} maxLength={100} placeholder="اسم المشروع"/><textarea value={projectDescription} onChange={e=>setProjectDescription(e.target.value)} maxLength={500} rows={2} placeholder="وصف مختصر (اختياري)"/><button disabled={busy||projectName.trim().length<2} onClick={()=>void createProject()}>إنشاء المشروع</button></div>}
    </section>
    <section className={styles.panel}><div className={styles.sectionTitle}><div><h3>أعضاء المؤسسة</h3><p>الأدوار الحالية وصلاحيات الوصول.</p></div><span>{members.length}</span></div>
     {members.map(member=><article className={styles.member} key={member.user_id}><div><b>{member.display_name||member.email||"عضو"}</b><small>{member.email||member.user_id.slice(0,8)}</small></div><span>{roleLabel(member.role)}</span></article>)}
     {!members.length&&!loading&&<p className={styles.muted}>لا توجد بيانات أعضاء متاحة.</p>}
     {["owner","admin"].includes(myRole)&&<div className={styles.formBlock}><h4>دعوة عضو بالبريد</h4><input type="email" dir="ltr" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="member@example.com"/><select value={inviteRole} onChange={e=>setInviteRole(e.target.value as Invitation["role"])}><option value="developer">مطور</option><option value="viewer">مشاهد</option><option value="admin" disabled={myRole!=="owner"}>مدير مؤسسة (للمالك فقط)</option></select><select value={inviteProject} onChange={e=>setInviteProject(e.target.value)}><option value="">كل المؤسسة</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name} فقط</option>)}</select><button disabled={busy||!inviteEmail.trim()} onClick={()=>void inviteMember()}>إنشاء الدعوة</button><small>يجب أن يكون البريد مرتبطًا بحساب مسجل. ستظهر الدعوة في بريده الوارد داخل المنصة؛ إرسال رسالة بريد خارجية يحتاج ربط خدمة بريد موثقة.</small></div>}
    </section>
   </div>
   <section className={styles.panel}><div className={styles.sectionTitle}><div><h3>الدعوات المعلقة</h3><p>الدعوات التي لم يتم قبولها أو رفضها بعد.</p></div><span>{invitations.length}</span></div>
    {invitations.map(invite=><article className={styles.member} key={invite.id}><div><b>{invite.email}</b><small>{invite.project_id?"مشروع محدد":"كل المؤسسة"} · تنتهي {new Date(invite.expires_at).toLocaleDateString("ar-EG")}</small></div><span>{roleLabel(invite.role)}</span></article>)}
    {!invitations.length&&!loading&&<p className={styles.muted}>لا توجد دعوات معلقة.</p>}
   </section>
   </>}
  </section>}
 </section>;
}
