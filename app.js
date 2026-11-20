"use strict";

const q = (selector) => document.querySelector(selector);
const parks = {misa:"미사경정공원", olympic:"올림픽공원"};
const purposes = {misa:{bike:"자전거 대여", walk:"산책"}, olympic:{show:"공연 관람", walk:"산책"}};
const reported = new Set();
const selection = {park:"misa", activity:"bike"};
const formatDay = new Intl.DateTimeFormat("ko-KR",{timeZone:"UTC",month:"long",day:"numeric",weekday:"short"});
let data;

function node(tag, content, cls) {
  const el=document.createElement(tag);
  if (content!==undefined) el.textContent=content;
  if (cls) el.className=cls;
  return el;
}
function source(key) { return data.sources[key]; }
function stamp(iso) { return iso.slice(0,16).replace("T"," ")+" KST"; }
function today() {
  const parts=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"});
  return parts.format(new Date());
}
function recent(key,days) {
  const s=source(key);
  if (!s || !s.ok || reported.has(key)) return false;
  const verified=Math.min(Date.parse(s.acquired),Date.parse(s.checked));
  return Number.isFinite(verified) && Date.now()-verified < days*86400000;
}
function external(key, label) {
  const s=source(key);
  const a=node("a",label||s.name);
  a.href=s.url; a.target="_blank"; a.rel="noopener noreferrer";
  a.setAttribute("aria-label",(label||s.name)+" (새 창)");
  return a;
}
function evidence(key,label) {
  const s=source(key), bar=node("div",undefined,"evidence");
  bar.append(external(key,label), node("span","자료 확인 "+stamp(s.acquired)));
  return bar;
}
function card(kind, status, title, body) {
  const el=node("article",undefined,"card "+kind);
  if (status) el.append(node("span",status,"status"));
  el.append(node("h3",title));
  if (body) el.append(node("p",body));
  return el;
}
function pending(title,body,key) {
  const el=card("lead pending","확인 필요",title,body);
  el.append(evidence(key,"공식 원문 확인"));
  return el;
}
function bikeResult(day) {
  const found=data.overrides.filter(x=>x.park===selection.park && x.activity===selection.activity && x.dates.includes(day))
    .sort((a,b)=>b.published.localeCompare(a.published));
  const latest=found[0];
  if (!recent("notices",7) || !["closure","marathon"].every(k=>recent(k,7))) {
    return pending("자전거 대여 여부 확인 필요","마지막 공지 확인이 오래됐거나 원문을 열 수 없습니다. 방문일의 미사 공지를 확인하세요.","notices");
  }
  if (latest && found.some(x=>x.published===latest.published && x.status!==latest.status)) {
    return pending("대여 공지 내용 확인 필요","같은 날 게시된 안내의 적용 내용이 서로 다릅니다.","notices");
  }
  if (latest) {
    const closed=latest.status==="closed";
    const el=card(closed?"lead closed":"lead changed",closed?"휴장 공지 확인":"운영시간 변경",
      closed?"자전거 대여소 휴장":"자전거 대여는 오후 2시 이후",
      closed?"이날은 미사경정공원에서 대여 자전거를 빌릴 수 없습니다. 공지가 지정한 시설은 자전거 대여소입니다.":"마라톤으로 대여 시작 시각이 바뀝니다. 해당 날짜의 대여소에 적용되는 공지입니다.");
    el.append(node("p","공지 게시일 "+latest.published),evidence(latest.source,"날짜별 공지 원문"));
    return el;
  }
  const el=card("lead","확인 필요","이날 대여 여부는 확인이 필요합니다","확인한 변경 공지에 선택한 날짜가 없습니다. 방문 직전 새 공지를 확인하세요.");
  el.append(evidence("notices","최신 공지 확인"));
  return el;
}
function hoursCard(day) {
  if (!recent("hours",31)) return pending("일반 운영시간 확인 필요","계절별 이용시간 원문을 다시 확인하세요.","hours");
  const h=data.hours, month=Number(day.slice(5,7)), long=h.longMonths.includes(month);
  const text=long?"평일 "+h.weekday+" / 주말과 공휴일 "+h.longWeekend:"평일, 주말, 공휴일 "+h.shortWeekend;
  const el=card("","일반 운영시간",month+"월 자전거 대여 시간",text);
  el.append(node("p","매표는 종료 한 시간 전에 마감합니다. 날짜별 변경 공지가 우선합니다."),evidence("hours","계절별 운영시간 원문"));
  return el;
}
function showResult(day) {
  const coverage=data.meta.eventCoverage;
  if (!coverage.length) return pending("공연 일정 확인 필요","공연 API에서 자료를 받지 못했습니다. 공식 일정표에서 방문일을 선택하세요.","schedule");
  if (day<coverage[0] || day>coverage[1] || !recent("schedule",31))
    return pending("이 날짜의 공연 일정 확인 필요","확인한 일정표는 "+coverage[0]+"부터 "+coverage[1]+"까지입니다. 최신 공식 일정표에서 확인하세요.","schedule");
  const matches=data.events.filter(e=>e.start<=day && day<=e.end);
  const unconfirmed=matches.some(e=>!recent(e.source,31));
  const el=card(unconfirmed?"lead pending":"lead changed",unconfirmed?"확인 필요":"공식 일정표 확인",
    "방문일과 기간이 겹치는 공연 "+matches.length+"건",
    matches.length?"공연의 첫날과 마지막 날을 포함해 셌습니다. 실제 회차와 입장 시각은 각 공연 안내를 확인하세요.":"확인한 월간 일정표에서 해당 날짜와 기간이 겹치는 공연을 찾지 못했습니다. 추가 공지는 원문에서 확인하세요.");
  el.append(node("p","자료 출처는 올림픽공원 공식 월간 일정표입니다. 공연 API 연동은 미확인 상태입니다."));
  if (unconfirmed) el.append(node("p","원문을 확인하기 어려운 공연이 있습니다. 마지막으로 받은 기간을 표시합니다."));
  for (const event of matches) {
    const row=node("div",undefined,"event");
    row.append(node("strong",event.title),node("small",event.venue+" / "+event.start+" ~ "+event.end),
      evidence(event.source,recent(event.source,31)?"공연 상세 안내":"상세 연결 확인 필요"));
    el.append(row);
  }
  el.append(evidence("schedule","월간 공연 일정표"));
  return el;
}
function faqCard() {
  const list=data.faq.filter(f=>f.park===selection.park && f.activities.includes(selection.activity));
  if (!recent("faq",31)) return pending("기본 이용 안내 확인 필요","FAQ 원본을 다시 확인해야 합니다.","faq");
  const el=card("","공공데이터 FAQ","기본 이용 안내");
  for (const row of list) {
    const entry=node("details",undefined,"faq-line");
    entry.append(node("summary",row.title),node("p",row.body),node("p","원본 질문 "+row.id+" / 등록 "+row.registered),
      evidence("faq","FAQ 원본 파일"));
    el.append(entry);
  }
  el.append(evidence("faq","자주 묻는 질문정보"));
  return el;
}
function renderResult() {
  if (!data) return;
  const day=q("#visit-date").value, out=q("#cards");
  out.replaceChildren();
  const share=q("#visit-link");
  share.hidden=true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    q("#selection").textContent="방문 날짜를 입력하세요."; q("#announcement").textContent="방문 날짜가 필요합니다."; return;
  }
  const selected=parks[selection.park]+" / "+day.slice(0,4)+"년 "+formatDay.format(new Date(day+"T12:00:00Z"))+" / "+purposes[selection.park][selection.activity];
  q("#selection").textContent=selected;
  if (location.protocol==="https:") {
    const url=new URL(location.pathname,location.origin);
    const link=share.querySelector("a");
    link.textContent=url.href;
    url.search=new URLSearchParams({park:selection.park,activity:selection.activity,date:day});
    url.hash="result";
    link.href=url.href;
    link.setAttribute("aria-label",selected+" 공유 주소");
    share.hidden=false;
  }
  if (selection.park==="olympic") {
    out.append(showResult(day));
    const parking=card("",recent("parking",31)?"교통 안내":"확인 필요","공연장 주변 주차","공식 안내에서 주차장 위치와 이용요금을 확인하세요.");
    parking.append(evidence("parking","공식 주차 안내"));
    out.append(faqCard(),parking);
  } else if (selection.activity==="bike") {
    out.append(bikeResult(day),hoursCard(day),faqCard());
  } else {
    out.append(faqCard());
    const n=card("","공원 공지","산책길과 시설 변경 확인","자전거 대여소의 휴장일에는 대여 업무만 쉽니다. 산책길 이용 변경은 공원 공지에서 확인하세요.");
    n.append(evidence("notices","미사 공지사항")); out.append(n);
  }
  q("#announcement").textContent=selected+". "+out.querySelector("h3").textContent;
}
function activities() {
  const group=q("#activities"); group.replaceChildren();
  for (const [key,name] of Object.entries(purposes[selection.park])) {
    const label=node("label"), input=node("input"); input.type="radio"; input.name="activity"; input.value=key;
    input.checked=key===selection.activity;
    label.append(input,node("span",name));group.append(label);
  }
}
function renderSources() {
  const groups=[["공공데이터",["faq","d1","provider"]],["기관 공식 보완자료",["closure","marathon","notices","hours","parking","schedule"]]];
  if (data.events.length) groups.push(["공연별 상세 안내",data.events.map(e=>e.source)]);
  const root=q("#source-list"); root.replaceChildren();
  for (const [title,keys] of groups) {
    const group=node("section",undefined,"source-group");group.append(node("h2",title));
    for (const key of keys) {
      const s=source(key),row=node("div",undefined,"source-row");
      row.append(node("strong",s.name),node("small",s.org+" / 자료 확인 "+stamp(s.acquired)+" / 연결 점검 "+stamp(s.checked)));
      if (key==="d1" || key==="provider") row.append(node("small","공연 API 연결 보류. 수신한 XML 0건."));
      if (!s.ok || reported.has(key)) row.append(node("small","원문 연결 확인 필요"));
      const link=external(key,"원문 열기");link.className="open-link";row.append(link);
      const btn=node("button",reported.has(key)?"확인 필요 해제":"원문을 열 수 없음"); btn.type="button";btn.dataset.source=key;
      row.append(btn);group.append(row);
    }
    root.append(group);
  }
}
function renderAudit() {
  const m=data.meta, area=q("#audit");area.replaceChildren();
  const first=node("section",undefined,"audit-block");
  first.append(node("h2","원본과 반영 건수"),node("p","FAQ "+m.faqId+" / CSV "+m.faqRows+"행 중 "+data.faq.length+"행 사용 / 파일 기준 "+m.faqAsOf),
    node("p","휴장과 시간 변경 "+data.overrides.reduce((n,o)=>n+o.dates.length,0)+"일 / 공식 공지 2개"),
    node("p","공연 API "+m.apiId+" / 수신 자료 없음"),node("p",data.events.length?"별도 공식 일정표 "+data.events.length+"건 / "+m.eventCoverage.join(" ~ "):"공식 공연 일정표에서 직접 확인"),
    node("p","FAQ 원본 등록 기간 "+m.faqRegistered.join(" ~ ")),node("p","자료 제공 "+data.org));
  const demo=node("section",undefined,"audit-block");demo.append(node("h2","시연 날짜 열기"));
  for (const [park,activity,day,title] of [["misa","bike","2026-11-23","11월 23일 미사 자전거"],["olympic","show","2026-11-28","11월 28일 올림픽공원 공연"]]){
    const p=node("p"),a=node("a",title);a.href="?park="+park+"&activity="+activity+"&date="+day+"#result";a.className="open-link";p.append(a);demo.append(p);
  }
  area.append(first,demo);
}
function route() {
  const id=location.hash.slice(1),active=["sources","about","check"].includes(id)?id:"visit";
  document.querySelectorAll(".panel").forEach(panel=>panel.hidden=panel.id!==active);
  document.querySelectorAll("nav a").forEach(a=>a.hash==="#"+active?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current"));
  if (id==="result") requestAnimationFrame(()=>q("#result").scrollIntoView({block:"start"}));
}
async function start() {
  const params=new URLSearchParams(location.search);
  if (Object.hasOwn(parks,params.get("park"))) selection.park=params.get("park");
  const opts=purposes[selection.park];selection.activity=Object.hasOwn(opts,params.get("activity"))?params.get("activity"):Object.keys(opts)[0];
  q("#visit-date").value=params.get("date")||today();
  if (!q("#visit-date").value) q("#visit-date").value=today();
  document.querySelector('input[name="park"][value="'+selection.park+'"]').checked=true;
  activities();route();
  document.addEventListener("change",e=>{
    if (e.target.name==="park") {selection.park=e.target.value;selection.activity=Object.keys(purposes[selection.park])[0];activities();}
    if (e.target.name==="activity") selection.activity=e.target.value;
    if (["park","activity"].includes(e.target.name) || e.target.id==="visit-date") renderResult();
  });
  window.addEventListener("hashchange",route);
  try {
    if (location.protocol==="file:") {
      data=JSON.parse(q("#offline-records").textContent);
    } else {
      const response=await fetch("./records/park.json",{cache:"no-cache"});
      if (!response.ok) throw Error("snapshot");
      data=await response.json();
    }
    renderResult();renderSources();renderAudit();route();
    q("#source-list").addEventListener("click",e=>{
      const key=e.target.dataset.source;if (!key) return;
      if (reported.has(key)) reported.delete(key); else reported.add(key);
      renderSources(); renderResult(); q('button[data-source="'+key+'"]').focus();
    });
  } catch {
    const msg="자료를 불러오지 못했습니다. 공식 공원 공지에서 다시 확인하세요.";
    for (const id of ["#cards","#source-list","#audit"]) {
      const link=node("a","공식 공원 안내 열기");link.href="https://www.ksponco.or.kr/";
      q(id).replaceChildren(node("p",msg),link);
    }
  }
}
start();

