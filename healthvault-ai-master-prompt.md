# HealthVault AI — Master Build Prompt

*Give this document to Antigravity as the primary spec. It replaces the raw brainstorm — every requirement from that brainstorm is represented here, but organized, prioritized, and scoped into buildable phases.*

---

## 0. Mission

Build **HealthVault AI**: a personal health intelligence platform that turns a person's scattered medical PDFs, lab reports, and prescriptions into a longitudinal, searchable, explainable health record — with AI assistance that is always grounded in the user's own data, never in speculation.

This is **not** a PDF chatbot, a graph dashboard, or a basic RAG demo. It is a document-intelligence + analytics + AI-assistant product with the polish and information architecture of a real health-tech SaaS product (think: a blend of a personal health record, an analytics platform, and a document manager).

---

## 1. Non-Negotiable Rules

These apply to every phase, every feature, every AI-generated sentence. Violating them is a worse outcome than shipping fewer features.

1. **No diagnosis, ever.** The AI assistant and the insights engine describe *what the data shows* ("your recorded HbA1c has decreased across your uploaded reports"), never *what it means medically* ("your diabetes is improving").
2. **Every AI-extracted value starts unverified.** Nothing extracted from a document is treated as ground truth until the user confirms or edits it. Verification status is a first-class field on every data point.
3. **No inferred medication status.** A medicine is only marked "stopped" when the user says so — never because it's absent from a later report.
4. **No medication recommendations**, including from the medicine-identification feature. That feature only reads what's printed on the packaging and asks the user to verify against the physical item.
5. **Every number shown anywhere in the product must be traceable to a source report** (or explicitly marked as user-entered). Provenance is not optional polish — it's a data-integrity requirement.
6. **Insights and AI answers must cite their source data.** No unsupported claims, no "typical range for someone like you" style generalization, no speculative trend extrapolation.
7. **No raw stack traces or backend errors surfaced to users.** Every failure mode gets a designed error state.

---

## 2. Product Pillars

| Pillar | What it means here |
|---|---|
| Document Intelligence | OCR + extraction pipeline that turns uploaded reports into structured, provenance-linked data |
| Longitudinal Tracking | Every metric is a time series, not a snapshot |
| Trustworthy AI | Assistant and insights are grounded, cited, and scoped to described-not-diagnosed |
| Data Provenance | Every value traces back to a document and a location in it |
| Professional UX | Calm, dense-but-legible, SaaS-grade — not a form-heavy CRUD app |

---

## 3. How Scope Was Prioritized

Every candidate feature from the original brainstorm (32+ items) was scored on **Impact, Engineering Difficulty, Safety Risk, and Portfolio/Demo Value**, then bucketed into three shippable phases. The logic:

- **MVP** = the smallest version of the product that proves the core loop (upload → extract → verify → trend → ask AI) end-to-end, with the safety-critical pieces (verification, provenance) built in from day one rather than bolted on later.
- **V2** = features that deepen analytics and start to differentiate the product (medications, insights, comparisons, export).
- **V3** = high-effort or lower-frequency features that are impressive but not required to prove the concept (medicine image recognition, semantic RAG, anomaly detection, deep customization).

Cross-cutting engineering practices (async processing, caching, indexing, image compression) are **not a phase** — they're baseline requirements applied from the first upload pipeline onward, called out separately in §8.

---

## 4. Phase 1 — MVP (build this first)

Goal: a user can create an account, upload a real report, see it processed transparently, verify the extracted values, watch a metric trend build over time, and ask the AI assistant a grounded question about their own data.

### 4.1 Navigation & shell
Top nav: Dashboard, Health Records, Health Metrics, Timeline, AI Assistant, Settings. User menu + notifications icon (notifications can be a stub in MVP).

### 4.2 Onboarding
Signup → basic health profile (name, DOB, sex, optional user-entered conditions — clearly labeled "as entered by you, not diagnosed") → empty dashboard with a clear "Upload your first report" call to action.

### 4.3 Upload & Processing Pipeline
Drag-and-drop or file picker (PDF/image). Show real pipeline stages, not a spinner:
`Uploading → Reading document → OCR → Detecting report type → Extracting values → Normalizing → Validating → Ready for review`
Processing runs **asynchronously**, off the request thread. Low-confidence extractions are flagged inline ("Please verify this value") rather than silently accepted.

### 4.4 Data Verification Center
A dedicated screen listing every unverified value: metric name, AI-extracted value, source report link, **Confirm** / **Edit** actions. This is the trust mechanism for the whole product — build it early, not as an afterthought.

### 4.5 Health Records
List of uploaded documents with search, filter (type/date/status), and sort. Each row shows type, date, processing status, extracted-value count, verification status. Actions: View, Download, Delete (with confirmation dialog).

### 4.6 Report Detail Viewer
Split view: document preview on the left, extracted values on the right, each value showing its source page/location where technically feasible. This is where provenance becomes visible to the user.

### 4.7 Dashboard Overview
- **Health Overview** strip: 2–4 key recorded metrics with latest value, direction of change, and last-measured date. No composite "health score" — there's no defensible single-number methodology for that.
- **Metric cards**: name, latest value + unit, date, change vs. previous, sparkline, source report link. Clicking opens the metric detail page.
- **Recent Reports**, **Recent Activity**, **Missing/stale data** ("No blood pressure recorded in 6 months") as simple, honest callouts — not a scored "quality index" yet.

### 4.8 Metric Detail Page
Large interactive trend chart (date range selection, hover for exact values), summary stats (first/latest/highest/lowest, number of measurements), a chronological list of every measurement, and links to every source document. A short **AI explanation** paragraph is allowed here, but it must restate the numbers, not interpret them medically.

### 4.9 Health Timeline
Chronological feed of everything that happened: report uploaded, value extracted, medication added (once §5 ships). Each entry is clickable and expands to its detail.

### 4.10 AI Assistant (grounded Q&A)
Chat UI with a conversation sidebar, suggested starter questions ("Show my HbA1c trend," "What reports have I uploaded?"), and — critically — every answer must cite the report(s) or metric(s) it's based on. If the assistant doesn't have data to answer, it says so instead of guessing. Structured chart/table responses can wait for V2; MVP can answer in text + links to the relevant metric/report pages.

### 4.11 Basic Search
Postgres full-text search across report names, extracted metric names, and metric values. Semantic search is a V3 upgrade, not MVP.

### 4.12 Privacy basics
A simple settings page showing what's stored and a "delete my data" action. Full privacy center (sessions, connected services) is V3.

### 4.13 Design system baseline
Typography scale, spacing scale, color tokens (including a semantic set for status: verified/unverified/error/success), card/button/input/table components, empty states, skeleton loaders, and basic responsive breakpoints (desktop/tablet/mobile). See §9.

---

## 5. Phase 2 — V2

Ship after the MVP loop is solid and real reports are flowing through it cleanly.

| Feature | Spec summary |
|---|---|
| Medication Dashboard | Current meds, history, prescription upload, source-linked, user-confirmed start/stop only |
| Health Insights | Deterministic, template-driven insights (trend / change / data-quality / missing-data / report-activity) generated from validated data only — each shows its source and the logic that produced it |
| Comparison Center | Report vs. report, date vs. date, metric vs. metric, period vs. period, every value source-linked |
| Health Data Table | Sortable/filterable table of all metrics across all reports, CSV export |
| Export Center | CSV, JSON, and a generated PDF "Health Summary" clearly labeled as a summary of uploaded/user-entered data, not a diagnosis |
| Notifications | Processing complete, values need verification, summary ready, processing failed — in-app only for V2 |
| AI Assistant structured responses | Assistant can return a chart or table component alongside text (via a structured backend response schema, not string-parsing) for data questions like "show my weight over the last year" |
| Extensible report categories | Diabetes, Blood, Heart, Thyroid, Kidney, Liver, Lipid, Vitamin, Urine, Hormonal, Prescription, Imaging, Other — architected so new categories don't require a schema migration |
| Customizable dashboard | Pin/remove/reorder metric cards, choose a default date range |
| Richer visualization | Date-range zoom, metric overlays, comparison charts, report markers on the timeline |

---

## 6. Phase 3 — V3 (advanced / differentiators)

Build these once V2 is stable and there's a reason to invest further (portfolio depth, real users asking for it).

- **Medicine identification**: photo → OCR + vision → candidate match → user confirms against the physical packaging. Always labeled "AI identification — please verify," never a dosage/usage recommendation.
- **Hybrid semantic search**: vector retrieval layered on top of the Postgres full-text search from MVP, extended to chat history.
- **Rule-based change/anomaly flags**: "this value moved outside its own historical range" — flagged as a data observation, explicitly not a clinical alert.
- **Report tagging, notes, doctor/lab metadata** enrichment.
- **Advanced Data Quality Dashboard**: duplicate-report detection, missing dates, low-confidence-extraction rollup, completeness scoring per category.
- **Full Privacy Center**: connected services, sessions/devices, granular data export/delete.
- **Deep dashboard customization**: user-defined widgets, saved views.
- **Dark/light mode** and a full keyboard-accessibility pass (WCAG AA).

---

## 7. Information Architecture

```
Dashboard
Health Records
  └─ Report Detail Viewer
  └─ Data Verification Center
Health Metrics
  └─ Metric Detail Page
Timeline
Medications           (V2)
Insights              (V2)
Compare               (V2)
AI Assistant
Settings
  └─ Profile
  └─ Data Quality      (V2/V3)
  └─ Export Center      (V2)
  └─ Privacy Center      (V3)
```

---

## 8. System Architecture Notes

- **Pipeline**: upload → OCR → report-type classification → structured extraction → normalization (units, reference ranges) → validation/confidence scoring → verification queue. Runs as a background job, not inline with the HTTP request.
- **Storage**: relational store (Postgres) for structured metrics, medications, and metadata; object storage for source documents; a vector index for semantic search, added in V3.
- **Search**: Postgres full-text search + metadata filters for MVP; vector/hybrid retrieval layered in for V3.
- **AI responses**: the assistant should return structured JSON (text + optional chart/table spec + source citations) that the frontend renders into components — not free-text that gets regex-parsed for chart triggers.
- **Performance baseline (applies from MVP onward)**: async OCR/extraction jobs, paginated list views, lazy-loaded charts, image compression on upload, indexed lookups on the metrics table (by user, metric type, date).

---

## 9. Design System Requirements

Tone: **professional, calm, trustworthy, data-focused.** Avoid generic Bootstrap defaults, walls of text, heavy gradients, cutesy medical iconography, and unnecessary animation.

Define once, reuse everywhere: typography scale, spacing scale, border-radius scale, color tokens (including semantic verified/unverified/error/success states — status should never be color-only, pair it with an icon or label), button/input/card/table/badge/alert/dialog/dropdown/toast/skeleton/empty-state components.

Every major section needs a designed empty state with a clear next action (e.g., "No diabetes reports yet — upload your first one to start building your history") and a designed error state for its likely failure modes (OCR failed, unsupported file, file too large, AI unavailable) — never a raw stack trace.

---

## 10. Definition of Done for MVP

- [ ] A user can sign up, land on an empty dashboard with a clear next action, and upload a real PDF report.
- [ ] Processing shows real, truthful stage-by-stage progress and fails gracefully with a designed error state.
- [ ] Every extracted value appears in the Verification Center until confirmed or edited.
- [ ] Confirmed values appear on the dashboard, on their metric detail page (with chart + history), and on the timeline.
- [ ] Every value on every screen links back to its source report.
- [ ] The AI assistant answers a grounded question about the user's own data and cites its source; it declines rather than guesses when it lacks data.
- [ ] No screen presents unverified data as fact, and no copy anywhere states or implies a diagnosis.
