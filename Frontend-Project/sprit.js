/* Simple professional JS app for gender-responsive DV support
   - Local DB stored at "dv-db"
   - Role saved at "dv-role"
   - Gender filter saved at "dv-gender"
   - Cross-tab sync via storage event
*/

/* ---------------------- Utilities ---------------------- */
function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2,9)}`;
}
const now = () => new Date().toISOString();

/* ---------------------- Initial DB ---------------------- */
const initialDB = {
  users: [
    { id: "u-admin", name: "Admin", role: "Admin" },
    { id: "u-c-1", name: "Case Worker", role: "Counsellor" },
    { id: "u-l-1", name: "Legal Advisor", role: "Legal Advisor" }
  ],
  content: {
    // gender-aware resources
    legalResources: [
      { id: "lr-1", gender: "female", title: "Women: Legal Rights & Protection Orders", url: "https://www.thehotline.org/", description: "Overview of protections, orders and seeking counsel." },
      { id: "lr-2", gender: "male", title: "Men: Legal Assistance & Shelter Info", url: "#", description: "Legal support tailored for male survivors, including confidentiality." },
      { id: "lr-3", gender: "nonbinary", title: "LGBTQ+: Specialized Legal Support", url: "#", description: "Resources for non-binary & LGBTQ+ survivors." }
    ],
    healthRisks: [
      { id: "hr-1", gender: "female", title: "Female Safety Planning", description: "Check-in plan, hiding essentials, trusted contacts." },
      { id: "hr-2", gender: "male", title: "Male Survivor Safety Guidance", description: "Male survivors may face stigma — seek confidential services." },
      { id: "hr-3", gender: "nonbinary", title: "Non-binary Safety & Health", description: "Inclusive resources and trauma-informed care options." }
    ],
    supportServices: [
      { id: "ss-1", gender: "all", title: "National DV Hotline (24/7)", url: "tel:18007997233", contact: "1-800-799-7233", description: "Confidential 24/7 support." }
    ]
  },
  helpRequests: [],
  legalQuestions: []
};

/* ---------------------- Storage helpers ---------------------- */
const DB_KEY = "dv-db";
const ROLE_KEY = "dv-role";
const GENDER_KEY = "dv-gender";

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return structuredClone(initialDB);
    return JSON.parse(raw);
  } catch {
    return structuredClone(initialDB);
  }
}
function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

/* ---------------------- App State ---------------------- */
let db = loadDB();

/* ---------------------- DOM refs ---------------------- */
const roleSelect = document.getElementById("roleSelect");
const genderSelect = document.getElementById("genderSelect");
const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
const views = Array.from(document.querySelectorAll(".view"));
const modal = document.getElementById("modal");

/* main elements */
const guidanceEl = document.getElementById("genderGuidance");
const guidanceList = document.getElementById("guidanceList");
const latestResources = document.getElementById("latestResources");
const statsEl = document.getElementById("stats");
const resourcesContainer = document.getElementById("resourcesContainer");
const requestsContainer = document.getElementById("requestsContainer");
const legalContainer = document.getElementById("legalContainer");
const usersContainer = document.getElementById("usersContainer");

/* inputs */
const resourceSearch = document.getElementById("resourceSearch");
const requestSearch = document.getElementById("requestSearch");
const requestFilter = document.getElementById("requestFilter");
const legalSearch = document.getElementById("legalSearch");

/* buttons */
const newRequestBtn = document.getElementById("newRequestBtn");
const newQuestionBtn = document.getElementById("newQuestionBtn");
const addResourceBtn = document.getElementById("addResourceBtn");
const seedBtn = document.getElementById("seedBtn");
const clearBtn = document.getElementById("clearBtn");

/* misc */
document.getElementById("year").textContent = new Date().getFullYear();

/* ---------------------- Init Selects ---------------------- */
const ROLES = ["Victim/Survivor", "Counsellor", "Legal Advisor", "Admin"];
const GENDERS = [
  { id: "all", label: "All" },
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "nonbinary", label: "Non-binary / LGBTQ+" }
];

ROLES.forEach(r => {
  const opt = document.createElement("option");
  opt.value = r;
  opt.textContent = r;
  roleSelect.appendChild(opt);
});
GENDERS.forEach(g => {
  const opt = document.createElement("option");
  opt.value = g.id;
  opt.textContent = g.label;
  genderSelect.appendChild(opt);
});

/* restore saved role & gender */
roleSelect.value = localStorage.getItem(ROLE_KEY) || "Victim/Survivor";
genderSelect.value = localStorage.getItem(GENDER_KEY) || "all";

/* ---------------------- Helpers ---------------------- */
function getCurrentRole(){ return roleSelect.value; }
function getCurrentGender(){ return genderSelect.value; }

function openView(name){
  views.forEach(v => v.classList.toggle("hidden", !v.id.endsWith(name)));
  navButtons.forEach(b => b.classList.toggle("active", b.dataset.view === name));
  // hide admin if not admin role
  document.getElementById("adminBtn").style.display = getCurrentRole() === "Admin" ? "" : "none";
}

function showModal(html){
  modal.innerHTML = `<div class="modal-card">${html}</div>`;
  modal.classList.remove("hidden");
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  }, { once: true });
}
function closeModal(){ modal.classList.add("hidden"); modal.innerHTML = ""; }

/* simple templating */
function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else e.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (typeof c === "string") e.appendChild(document.createTextNode(c));
    else if (c instanceof Node) e.appendChild(c);
  });
  return e;
}

/* ---------------------- Rendering ---------------------- */

function renderGuidance(){
  const g = getCurrentGender();
  const items = [
    ...db.content.healthRisks.filter(r => r.gender === g || r.gender === "all"),
    ...db.content.legalResources.filter(r => r.gender === g || r.gender === "all"),
  ];
  guidanceList.innerHTML = "";
  if (g === "all") guidanceEl.textContent = "Guidance across genders — choose a specific gender for tailored advice.";
  else guidanceEl.textContent = `Tailored guidance for ${GENDERS.find(x=>x.id===g).label}.`;
  items.slice(0,5).forEach(it => {
    const li = el("li", {}, [`${it.title} — ${it.description || ""}`]);
    guidanceList.appendChild(li);
  });
}

function renderLatestResources(){
  latestResources.innerHTML = "";
  const g = getCurrentGender();
  const all = [
    ...db.content.supportServices,
    ...db.content.legalResources,
    ...db.content.healthRisks
  ].filter(r => r.gender === g || r.gender === "all" || g === "all");
  all.slice(0,6).forEach(it => {
    const card = el("div", { class: "resource-item" }, [
      el("h4", {}, [it.title]),
      el("p", {}, [it.description || ""]),
      el("p", { class: "muted" }, [it.contact || ""])
    ]);
    if (it.url) {
      const a = el("a", { href: it.url, target: "_blank" }, ["Open"]);
      card.appendChild(a);
    }
    latestResources.appendChild(card);
  });
}

function renderStats(){
  const counts = {
    resources: (db.content.legalResources.length + db.content.healthRisks.length + db.content.supportServices.length),
    requests: db.helpRequests.length,
    legalQs: db.legalQuestions.length
  };
  statsEl.innerHTML = `
    <div class="muted">Resources: <strong>${counts.resources}</strong></div>
    <div class="muted">Help Requests: <strong>${counts.requests}</strong></div>
    <div class="muted">Legal Questions: <strong>${counts.legalQs}</strong>
  `;
}

/* RESOURCES VIEW */
function renderResources(filterText = ""){
  const container = resourcesContainer;
  container.innerHTML = "";
  const g = getCurrentGender();
  const all = [
    ...db.content.legalResources,
    ...db.content.healthRisks,
    ...db.content.supportServices
  ].filter(r => (g === "all" || r.gender === g || r.gender === "all"))
   .filter(r => !filterText || `${r.title} ${r.description}`.toLowerCase().includes(filterText.toLowerCase()));

  all.forEach(it => {
    const card = el("div", { class: "resource-item" }, [
      el("h4", {}, [it.title]),
      el("p", {}, [it.description || ""]),
      el("p", { class: "muted" }, [`Gender: ${it.gender || "all"}`])
    ]);

    const btns = el("div", { class: "actions" }, []);
    const edit = el("button", {}, ["Edit"]);
    edit.onclick = () => openEditResource(it.id);
    const del = el("button", {}, ["Delete"]);
    del.onclick = () => { if (confirm("Delete resource?")) { deleteResource(it.id); } };
    btns.appendChild(edit);
    btns.appendChild(del);
    card.appendChild(btns);
    container.appendChild(card);
  });
}

/* REQUESTS VIEW */
function renderRequests(filterText = "", statusFilter = ""){
  const container = requestsContainer;
  container.innerHTML = "";
  const filtered = db.helpRequests
    .filter(r => !filterText || `${r.fromName} ${r.message}`.toLowerCase().includes(filterText.toLowerCase()))
    .filter(r => !statusFilter || r.status === statusFilter)
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (filtered.length === 0) container.innerHTML = "<div class='muted'>No requests found.</div>";

  filtered.forEach(r => {
    const left = el("div", {}, [
      el("strong", {}, [r.fromName]),
      el("div", { class: "muted" }, [new Date(r.createdAt).toLocaleString()]),
      el("p", {}, [r.message])
    ]);
    const right = el("div", {}, []);
    const status = el("div", { class: "status-pill" }, [r.status]);
    right.appendChild(status);

    // role-based actions
    const actions = el("div", { class: "actions" }, []);
    if (["Admin","Counsellor"].includes(getCurrentRole())) {
      const inprog = el("button", {}, ["Mark In Progress"]);
      inprog.onclick = () => updateRequestStatus(r.id,"in-progress");
      const resolved = el("button", {}, ["Resolve"]);
      resolved.onclick = () => updateRequestStatus(r.id,"resolved");
      actions.appendChild(inprog);
      actions.appendChild(resolved);
    }
    const card = el("div", { class: "card request-card" }, [left, right]);
    card.appendChild(actions);
    container.appendChild(card);
  });
}

/* LEGAL Qs */
function renderLegal(query = ""){
  const container = legalContainer;
  container.innerHTML = "";
  const all = db.legalQuestions
    .filter(q => !query || `${q.fromName} ${q.question} ${q.answer || ""}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (all.length === 0) container.innerHTML = "<div class='muted'>No legal questions yet.</div>";

  all.forEach(q => {
    const card = el("div", { class: "card" }, [
      el("strong", {}, [q.fromName]),
      el("div", { class: "muted" }, [new Date(q.createdAt).toLocaleString()]),
      el("p", {}, [q.question]),
      el("p", {}, [q.answer ? el("span", { class: "muted" }, [`Answer: ${q.answer}`]) : el("em", { class: "muted" }, ["No answer yet."])])
    ]);

    if (getCurrentRole() === "Legal Advisor" || getCurrentRole() === "Admin") {
      const answerBtn = el("button", {}, ["Answer"]);
      answerBtn.onclick = () => openAnswerModal(q.id);
      card.appendChild(answerBtn);
    }
    container.appendChild(card);
  });
}

/* USERS (admin) */
function renderUsers(){
  usersContainer.innerHTML = "";
  db.users.forEach(u => {
    const row = el("div", { class: "card" }, [
      el("div", {}, [ el("strong",{},[u.name]), el("div",{class:"muted"},[u.role]) ])
    ]);
    usersContainer.appendChild(row);
  });
}

/* ---------------------- Data mutations ---------------------- */
function addHelpRequest(fromName, message){
  db.helpRequests.push({
    id: uid("req"),
    fromName, message,
    createdAt: now(),
    status: "new",
    notes: []
  });
  saveDB(db); refreshUI();
}

function addLegalQuestion(fromName, question){
  db.legalQuestions.push({
    id: uid("q"), fromName, question, createdAt: now(), answer: ""
  });
  saveDB(db); refreshUI();
}

function updateRequestStatus(id, status){
  const r = db.helpRequests.find(x=>x.id===id); if (!r) return;
  r.status = status; saveDB(db); refreshUI();
}

function deleteResource(id){
  ["legalResources","healthRisks","supportServices"].forEach(k => {
    db.content[k] = db.content[k].filter(x => x.id !== id);
  });
  saveDB(db); refreshUI();
}

/* editing */
function openEditResource(id){
  // find resource
  const all = [...db.content.legalResources, ...db.content.healthRisks, ...db.content.supportServices];
  const r = all.find(x => x.id === id);
  if (!r) return alert("Resource not found");
  showModal(`
    <h3>Edit Resource</h3>
    <label>Title</label>
    <input id="editTitle" value="${escapeHtml(r.title)}" />
    <label>Gender</label>
    <select id="editGender">
      <option value="all">All</option>
      <option value="female">Female</option>
      <option value="male">Male</option>
      <option value="nonbinary">Non-binary</option>
    </select>
    <label>Description</label>
    <textarea id="editDesc">${escapeHtml(r.description || "")}</textarea>
    <label>URL</label>
    <input id="editUrl" value="${escapeHtml(r.url || "")}" />
    <div style="margin-top:10px;text-align:right">
      <button id="saveEdit">Save</button>
      <button id="cancelEdit">Cancel</button>
    </div>
  `);
  document.getElementById("editGender").value = r.gender || "all";
  document.getElementById("cancelEdit").onclick = closeModal;
  document.getElementById("saveEdit").onclick = () => {
    r.title = document.getElementById("editTitle").value.trim();
    r.gender = document.getElementById("editGender").value;
    r.description = document.getElementById("editDesc").value.trim();
    r.url = document.getElementById("editUrl").value.trim();
    saveDB(db); closeModal(); refreshUI();
  };
}

function openAnswerModal(qid){
  const q = db.legalQuestions.find(x => x.id === qid);
  if (!q) return;
  showModal(`
    <h3>Answer Question</h3>
    <p><strong>${escapeHtml(q.fromName)}</strong>: ${escapeHtml(q.question)}</p>
    <label>Answer</label>
    <textarea id="answerText">${escapeHtml(q.answer || "")}</textarea>
    <div style="margin-top:10px;text-align:right">
      <button id="saveAns">Save</button>
      <button id="cancelAns">Cancel</button>
    </div>
  `);
  document.getElementById("cancelAns").onclick = closeModal;
  document.getElementById("saveAns").onclick = () => {
    q.answer = document.getElementById("answerText").value.trim();
    saveDB(db); closeModal(); refreshUI();
  };
}

/* Add resource modal */
function openAddResource(){
  showModal(`
    <h3>Add Resource</h3>
    <label>Title</label><input id="rTitle" />
    <label>Gender</label>
    <select id="rGender">
      <option value="all">All</option>
      <option value="female">Female</option>
      <option value="male">Male</option>
      <option value="nonbinary">Non-binary</option>
    </select>
    <label>Type</label>
    <select id="rType">
      <option value="legalResources">Legal Resource</option>
      <option value="healthRisks">Health Risk / Guidance</option>
      <option value="supportServices">Support Service</option>
    </select>
    <label>Description</label><textarea id="rDesc"></textarea>
    <label>URL</label><input id="rUrl" />
    <div style="margin-top:10px;text-align:right">
      <button id="saveR">Add</button><button id="cancelR">Cancel</button>
    </div>
  `);
  document.getElementById("cancelR").onclick = closeModal;
  document.getElementById("saveR").onclick = () => {
    const title = document.getElementById("rTitle").value.trim();
    const gender = document.getElementById("rGender").value;
    const type = document.getElementById("rType").value;
    const desc = document.getElementById("rDesc").value.trim();
    const url = document.getElementById("rUrl").value.trim();
    if (!title) return alert("Title required");
    db.content[type].push({ id: uid("r"), gender, title, description: desc, url });
    saveDB(db); closeModal(); refreshUI(); 
  };
}

/* Submit help request modal */
function openRequestModal(){
  showModal(`
    <h3>Submit Help Request</h3>
    <label>Your name</label><input id="reqName" />
    <label>Brief message</label><textarea id="reqMsg"></textarea>
    <div style="margin-top:10px;text-align:right">
      <button id="sendReq">Send</button><button id="cancelReq">Cancel</button>
    </div>
  `);
  document.getElementById("cancelReq").onclick = closeModal;
  document.getElementById("sendReq").onclick = () => {
    const name = document.getElementById("reqName").value.trim();
    const msg = document.getElementById("reqMsg").value.trim();
    if (!name || !msg) return alert("Fill all fields");
    addHelpRequest(name, msg); closeModal();
    alert("Request submitted — a counsellor will respond.");
  };
}

/* Submit legal question modal */
function openLegalModal(){
  showModal(`
    <h3>Ask a Legal Question</h3>
    <label>Your name</label><input id="qName" />
    <label>Question</label><textarea id="qText"></textarea>
    <div style="margin-top:10px;text-align:right">
      <button id="sendQ">Send</button><button id="cancelQ">Cancel</button>
    </div>
  `);
  document.getElementById("cancelQ").onclick = closeModal;
  document.getElementById("sendQ").onclick = () => {
    const name = document.getElementById("qName").value.trim();
    const txt = document.getElementById("qText").value.trim();
    if (!name || !txt) return alert("Fill all fields");
    addLegalQuestion(name, txt); closeModal();
    alert("Question sent — a legal advisor will reply.");
  };
}

/* ---------------------- Admin actions ---------------------- */
function seedDefault(){
  db = structuredClone(initialDB);
  saveDB(db); refreshUI();
}
function clearDB(){
  if (!confirm("Clear local data? This cannot be undone.")) return;
  localStorage.removeItem(DB_KEY);
  db = structuredClone(initialDB);
  refreshUI();
}

/* ---------------------- Misc ---------------------- */
function escapeHtml(s){ return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

/* ---------------------- Refresh UI ---------------------- */
function refreshUI(){
  renderGuidance();
  renderLatestResources();
  renderStats();
  renderResources(resourceSearch.value || "");
  renderRequests(requestSearch.value || "", requestFilter.value || "");
  renderLegal(legalSearch.value || "");
  renderUsers();
}

/* ---------------------- Event wiring ---------------------- */
/* navigation */
navButtons.forEach(b => b.addEventListener("click", () => openView(b.dataset.view)));
openView("dashboard");

/* selects */
roleSelect.addEventListener("change", () => {
  localStorage.setItem(ROLE_KEY, roleSelect.value);
  // admin button show/hide
  document.getElementById("adminBtn").style.display = getCurrentRole() === "Admin" ? "" : "none";
  refreshUI();
});
genderSelect.addEventListener("change", () => {
  localStorage.setItem(GENDER_KEY, genderSelect.value);
  refreshUI();
});

/* search & filters */
resourceSearch.addEventListener("input", () => renderResources(resourceSearch.value));
requestSearch.addEventListener("input", () => renderRequests(requestSearch.value, requestFilter.value));
requestFilter.addEventListener("change", () => renderRequests(requestSearch.value, requestFilter.value));
legalSearch.addEventListener("input", () => renderLegal(legalSearch.value));

/* buttons */
newRequestBtn.addEventListener("click", openRequestModal);
newQuestionBtn.addEventListener("click", openLegalModal);
addResourceBtn.addEventListener("click", () => {
  if (getCurrentRole() !== "Admin") return alert("Only Admin can add resources.");
  openAddResource();
});
seedBtn.addEventListener("click", () => {
  if (!confirm("Reset to default sample data?")) return;
  seedDefault();
});
clearBtn.addEventListener("click", clearDB);

/* modal close on ESC */
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

/* storage sync across tabs */
window.addEventListener("storage", (e) => {
  if (e.key === DB_KEY) {
    db = loadDB(); refreshUI();
  } else if (e.key === ROLE_KEY) {
    roleSelect.value = localStorage.getItem(ROLE_KEY) || "Victim/Survivor";
    refreshUI();
  } else if (e.key === GENDER_KEY) {
    genderSelect.value = localStorage.getItem(GENDER_KEY) || "all";
    refreshUI();
  }
});

/* page-ready */
(function init(){
  // Render initial content
  renderGuidance();
  renderLatestResources();
  renderStats();
  renderResources();
  renderRequests();
  renderLegal();
  renderUsers();
  // hide admin nav unless admin
  document.getElementById("adminBtn").style.display = getCurrentRole() === "Admin" ? "" : "none";
})();
