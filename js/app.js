const ORG = "southranch";
const PROJECT = "SBWeb";
const DEFINITION_PREFIX = "smartborder-api";

const environments = ["dev", "uat", "liiuat", "prod", "liiprod"];

const statusFilters = [
  { id: "all", label: "All" },
  { id: "passed", label: "Passed" },
  { id: "partial", label: "Partial" },
  { id: "failed", label: "Failed" },
  { id: "never", label: "Never built" },
];

// branch = suffix after "{env}/" (e.g. uat/aes → branch is "aes")
// definitionId = from the pipeline URL when opened in Azure DevOps (?definitionId=123)
const pipelines = [
  { name: "Abi Tools", branch: "abitools", definitionId: 73 },
  { name: "ABI Transmission", branch: "abitransmission", definitionId: 96 },
  { name: "ACE", branch: "ace", definitionId: 71 },
  { name: "ACI", branch: "aci", definitionId: 72 },
  { name: "AES", branch: "aes", definitionId: 64 },
  { name: "AutoExport", branch: "smiautoexport", definitionId: 63 },
  { name: "BOL", branch: "bol", definitionId: 69 },
  { name: "CA Entry", branch: "caentry", definitionId: 122 },
  { name: "CA Product", branch: "caproduct", definitionId: 124 },
  { name: "CA Profile", branch: "caprofile", definitionId: 126 },
  { name: "CCD", branch: "ccd", definitionId: 127 },
  { name: "CCI", branch: "cci", definitionId: 121 },
  { name: "CommercialInvoiceExternal", branch: "commercialinvoiceexternal", definitionId: 68 },
  { name: "Customs Info", branch: "customsinfo", definitionId: 91 },
  { name: "DIS", branch: "dis", definitionId: 89 },
  { name: "Drawback", branch: "drawback", definitionId: 53 },
  { name: "Ecomm External API", branch: "ecommerceext", definitionId: 110 },
  { name: "Ecomm Portal", branch: "ecommportal", definitionId: 118 },
  { name: "Ecommerce", branch: "ecommerce", definitionId: 77 },
  { name: "Entry", branch: "entry", definitionId: 65 },
  { name: "EntryUtilities", branch: "entryutilities", definitionId: 67 },
  { name: "Flatworld", branch: "flatworld", definitionId: 128 },
  { name: "Inbond", branch: "inbond", definitionId: 70 },
  { name: "inbondcontrol", branch: "inbondcontrol", definitionId: 57 },
  { name: "ISF", branch: "isf", definitionId: 66 },
  { name: "LII Apple", branch: "liiapple", definitionId: 119 },
  { name: "LII Clearances", branch: "liiclearances", definitionId: 80 },
  { name: "LII CODA", branch: "liicoda", definitionId: 81 },
  { name: "LII Custom", branch: "liicustom", definitionId: 94 },
  { name: "LII ECFA", branch: "liiecfa", definitionId: 84 },
  { name: "LII EVOLVE", branch: "liievolve", definitionId: 82 },
  { name: "Lumber Permit", branch: "lumberpermit", definitionId: 75 },
  { name: "Pga", branch: "pga", definitionId: 74 },
  { name: "Platform", branch: "platform", definitionId: 51 },
  { name: "Polaris", branch: "polaris", definitionId: 83 },
  { name: "Product", branch: "product", definitionId: 62 },
  { name: "Proforma", branch: "commercialinvoice", definitionId: 76 },
  { name: "QueueService", branch: "queueservice", definitionId: 99 },
  { name: "Recon", branch: "recon", definitionId: 111 },
  { name: "RIV", branch: "riv", definitionId: 92 },
  { name: "SB Common", branch: "sbcommon", definitionId: 90 },
  { name: "Ticketing", branch: "ticketing", definitionId: 125 },
  { name: "USMCA", branch: "usmca", definitionId: 61 },
];

let activeEnv = environments[0];
let activeStatus = "all";
const rows = [];
const badgeCache = new Map();
const STORAGE_KEY = "sb-build-status-filters";

function loadFilters() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored?.env && environments.includes(stored.env)) {
      activeEnv = stored.env;
    }
    const validStatuses = statusFilters.map((filter) => filter.id);
    if (stored?.status && validStatuses.includes(stored.status)) {
      activeStatus = stored.status;
    }
  } catch {
    // keep defaults
  }
}

function saveFilters() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ env: activeEnv, status: activeStatus })
  );
}

function buildBadgeUrl(definition, branch) {
  const defSegment = encodeURIComponent("/" + definition.replace(/^\//, ""));
  const branchParam = encodeURIComponent(branch);
  return `https://dev.azure.com/${ORG}/${PROJECT}/_apis/build/status${defSegment}?branchName=${branchParam}`;
}

function buildPipelineUrl(definitionId) {
  if (definitionId) {
    return `https://dev.azure.com/${ORG}/${PROJECT}/_build?definitionId=${definitionId}`;
  }
  return `https://dev.azure.com/${ORG}/${PROJECT}/_build?definitionScope=%5C${encodeURIComponent(DEFINITION_PREFIX)}`;
}

function normalizeStatus(text) {
  if (!text) return "unknown";
  const lower = text.toLowerCase();
  if (lower === "succeeded") return "passed";
  if (lower === "partially succeeded") return "partial";
  if (lower === "failed") return "failed";
  if (lower === "never built") return "never";
  if (lower.includes("progress")) return "running";
  if (lower === "canceled") return "canceled";
  return "unknown";
}

function parseStatusFromSvg(svg) {
  const labels = [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)]
    .map((match) => match[1])
    .filter((label) => label !== "Azure Pipelines");
  return normalizeStatus(labels.at(-1));
}

async function loadBadge(badgeUrl) {
  const cached = badgeCache.get(badgeUrl);
  if (cached) return cached;

  try {
    const response = await fetch(badgeUrl);
    if (!response.ok) throw new Error("bad response");
    const svg = await response.text();
    const result = {
      status: parseStatusFromSvg(svg),
      objectUrl: URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })),
    };
    badgeCache.set(badgeUrl, result);
    return result;
  } catch {
    return { status: "unknown", objectUrl: badgeUrl };
  }
}

function applyFilters() {
  rows.forEach((row) => {
    const status = row.dataset.status || "unknown";
    const visible =
      activeStatus === "all" ||
      status === activeStatus ||
      status === "loading";
    row.classList.toggle("row-filtered", !visible);
    row.hidden = !visible;
  });
}

function loadRowBadge(row, img, badgeLink, badgeUrl, title) {
  badgeLink.title = title;

  const cached = badgeCache.get(badgeUrl);
  if (cached) {
    img.src = cached.objectUrl;
    row.dataset.status = cached.status;
    applyFilters();
    return;
  }

  row.dataset.status = "loading";
  applyFilters();

  loadBadge(badgeUrl).then(({ status, objectUrl }) => {
    img.src = objectUrl;
    row.dataset.status = status;
    applyFilters();
  });
}

function createRow(pipeline) {
  const { name, branch: branchSuffix } = pipeline;
  const definition = `${DEFINITION_PREFIX}/${name}`;
  const pipelineUrl = buildPipelineUrl(pipeline.definitionId);
  const branch = `${activeEnv}/${branchSuffix}`;
  const badgeUrl = buildBadgeUrl(definition, branch);

  const row = document.createElement("tr");
  row.dataset.pipeline = name;

  const nameCell = document.createElement("td");
  const nameLink = document.createElement("a");
  nameLink.className = "pipeline-link";
  nameLink.href = pipelineUrl;
  nameLink.target = "_blank";
  nameLink.rel = "noopener noreferrer";
  nameLink.textContent = name;
  nameCell.appendChild(nameLink);

  const statusCell = document.createElement("td");
  const badgeLink = document.createElement("a");
  badgeLink.className = "badge-link";
  badgeLink.href = pipelineUrl;
  badgeLink.target = "_blank";
  badgeLink.rel = "noopener noreferrer";

  const img = document.createElement("img");
  img.alt = `${name} ${activeEnv}`;
  badgeLink.appendChild(img);
  statusCell.appendChild(badgeLink);

  row.appendChild(nameCell);
  row.appendChild(statusCell);

  loadRowBadge(row, img, badgeLink, badgeUrl, `${name} · ${branch}`);
  return row;
}

function updateRowForEnv(row, pipeline) {
  const { name, branch: branchSuffix } = pipeline;
  const definition = `${DEFINITION_PREFIX}/${name}`;
  const branch = `${activeEnv}/${branchSuffix}`;
  const badgeUrl = buildBadgeUrl(definition, branch);
  const img = row.querySelector("img");
  const badgeLink = row.querySelector(".badge-link");

  img.alt = `${name} ${activeEnv}`;
  loadRowBadge(row, img, badgeLink, badgeUrl, `${name} · ${branch}`);
}

function renderTable() {
  const tbody = document.getElementById("pipeline-rows");

  if (rows.length === 0) {
    pipelines.forEach((pipeline) => {
      const row = createRow(pipeline);
      tbody.appendChild(row);
      rows.push(row);
    });
    return;
  }

  pipelines.forEach((pipeline, index) => {
    updateRowForEnv(rows[index], pipeline);
  });
}

function renderFilterTabs(containerId, items, activeId, onSelect, className = "filter-tab") {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const id = item.id ?? item;
    const label = item.label ?? item;
    btn.className = className + (id === activeId ? " active" : "");
    if (item.id && item.id !== "all") {
      btn.classList.add(`filter-tab--${item.id}`);
    }
    btn.textContent = label;
    btn.addEventListener("click", () => onSelect(id));
    container.appendChild(btn);
  });
}

function renderEnvTabs() {
  renderFilterTabs(
    "env-tabs",
    environments,
    activeEnv,
    (env) => {
      activeEnv = env;
      saveFilters();
      renderEnvTabs();
      renderTable();
    }
  );
}

function renderStatusTabs() {
  renderFilterTabs(
    "status-tabs",
    statusFilters,
    activeStatus,
    (status) => {
      activeStatus = status;
      saveFilters();
      renderStatusTabs();
      applyFilters();
    }
  );
}

loadFilters();
renderEnvTabs();
renderStatusTabs();
renderTable();
