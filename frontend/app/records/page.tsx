"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import { documentsApi } from "@/lib/api";
import Link from "next/link";
import {
  Upload, FileText, Trash2, Eye, CheckCircle, AlertTriangle,
  Clock, Search, Filter, ChevronDown, X, CloudUpload
} from "lucide-react";
import { format } from "date-fns";

const PIPELINE_STAGES = [
  { key: "uploading",   label: "Uploading" },
  { key: "reading",     label: "Reading" },
  { key: "ocr",         label: "OCR" },
  { key: "classifying", label: "Classifying" },
  { key: "extracting",  label: "Extracting" },
  { key: "normalizing", label: "Normalizing" },
  { key: "validating",  label: "Validating" },
  { key: "ready",       label: "Ready" },
];

interface UploadState {
  file: File;
  documentId: string | null;
  currentStage: string;
  completedStages: string[];
  error: string | null;
  done: boolean;
}

interface Document {
  id: string; original_filename: string; document_type: string | null;
  processing_status: string; report_date: string | null;
  extracted_values_count: number; verified_values_count: number;
  created_at: string; file_size_bytes: number | null;
}

export default function RecordsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [docsLoading, setDocsLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await documentsApi.list({ search: searchTerm || undefined });
      setDocuments(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch { /* handled */ }
    setDocsLoading(false);
  }, [searchTerm]);

  useEffect(() => { if (user) loadDocuments(); }, [user, loadDocuments]);

  const handleFiles = (files: File[]) => {
    const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
    for (const file of files) {
      if (!allowed.includes(file.type)) {
        alert(`Unsupported file type: ${file.name}. Use PDF, JPG, PNG, or WebP.`);
        continue;
      }
      if (file.size > 50 * 1024 * 1024) {
        alert(`File too large: ${file.name}. Maximum size is 50MB.`);
        continue;
      }
      uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    const uploadState: UploadState = {
      file, documentId: null, currentStage: "uploading",
      completedStages: [], error: null, done: false,
    };
    setUploads((prev) => [uploadState, ...prev]);

    try {
      const res = await documentsApi.upload(file);
      const docId = res.data.document_id;

      setUploads((prev) =>
        prev.map((u) =>
          u.file === file ? { ...u, documentId: docId, currentStage: "reading" } : u
        )
      );

      // Open SSE stream for real-time pipeline progress
      const token = localStorage.getItem("hv_access_token");
      const eventSource = new EventSource(
        `${API_BASE}/api/v1/processing/${docId}/stream`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const stage = data.stage;

        setUploads((prev) =>
          prev.map((u) => {
            if (u.file !== file) return u;
            const stageIndex = PIPELINE_STAGES.findIndex((s) => s.key === stage);
            const completed = PIPELINE_STAGES.slice(0, stageIndex).map((s) => s.key);
            return {
              ...u,
              currentStage: stage,
              completedStages: completed,
              done: stage === "ready",
              error: stage === "failed" ? (data.message || "Processing failed") : null,
            };
          })
        );

        if (stage === "ready" || stage === "failed") {
          eventSource.close();
          loadDocuments();
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        // Fall back to polling
        pollStatus(file, docId);
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setUploads((prev) =>
        prev.map((u) => (u.file === file ? { ...u, error: message, currentStage: "failed" } : u))
      );
    }
  };

  const pollStatus = async (file: File, docId: string) => {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await documentsApi.get(docId);
        const status = res.data.processing_status;
        setUploads((prev) =>
          prev.map((u) => (u.file === file ? { ...u, currentStage: status, done: status === "ready" } : u))
        );
        if (status === "ready" || status === "failed") {
          loadDocuments();
          break;
        }
      } catch { break; }
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await documentsApi.delete(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setDeleteConfirm(null);
    } catch { alert("Failed to delete document"); }
  };

  if (isLoading || !user) return null;

  return (
    <AppLayout>
      <div style={{ padding: "2rem 2.5rem", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
          <div>
            <h1 className="text-h1" style={{ marginBottom: "0.25rem" }}>Health Records</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              {total} report{total !== 1 ? "s" : ""} uploaded
            </p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={`drop-zone ${dragOver ? "drag-over" : ""}`}
          style={{ marginBottom: "1.75rem" }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(Array.from(e.dataTransfer.files)); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: "52px", height: "52px", borderRadius: "12px",
              background: dragOver ? "var(--color-brand-100)" : "var(--color-neutral-100)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s",
            }}>
              <CloudUpload size={24} color={dragOver ? "var(--color-brand-600)" : "var(--text-muted)"} />
            </div>
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                Drop your report here, or click to browse
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                PDF, JPEG, PNG or WebP · Maximum 50MB
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef} type="file" style={{ display: "none" }} multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => { if (e.target.files) handleFiles(Array.from(e.target.files)); }}
          />
        </div>

        {/* Active uploads */}
        {uploads.length > 0 && (
          <div style={{ marginBottom: "1.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {uploads.map((u, i) => (
              <div key={i} className="card" style={{ padding: "1rem 1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <FileText size={15} color="var(--color-brand-500)" />
                    <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{u.file.name}</span>
                  </div>
                  {u.done && <span className="badge badge-verified"><CheckCircle size={10} />Complete</span>}
                  {u.error && <span className="badge badge-error"><AlertTriangle size={10} />Failed</span>}
                </div>

                {u.error ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--color-error-text)", padding: "0.5rem 0.75rem", background: "var(--color-error-bg)", borderRadius: "6px" }}>
                    {u.error}
                  </div>
                ) : (
                  <div className="pipeline-stages">
                    {PIPELINE_STAGES.map((stage, si) => (
                      <div key={stage.key} style={{ display: "flex", alignItems: "center" }}>
                        <div className={`pipeline-stage ${
                          u.completedStages.includes(stage.key) ? "completed" :
                          u.currentStage === stage.key ? "active" : "pending"
                        }`}>
                          {u.completedStages.includes(stage.key) && <CheckCircle size={12} />}
                          {u.currentStage === stage.key && !u.done && (
                            <div style={{
                              width: "6px", height: "6px", borderRadius: "50%",
                              background: "var(--color-brand-500)",
                              flexShrink: 0,
                            }} />
                          )}
                          {stage.label}
                        </div>
                        {si < PIPELINE_STAGES.length - 1 && <div className="pipeline-connector" />}
                      </div>
                    ))}
                  </div>
                )}

                {u.done && u.documentId && (
                  <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                    <Link href={`/records/${u.documentId}/verify`}>
                      <button className="btn btn-primary btn-sm">Review extracted values →</button>
                    </Link>
                    <Link href={`/records/${u.documentId}`}>
                      <button className="btn btn-secondary btn-sm">View report</button>
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div style={{ position: "relative", marginBottom: "1.25rem" }}>
          <Search size={15} style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="input" placeholder="Search by filename..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: "2.5rem" }}
          />
        </div>

        {/* Documents list */}
        {docsLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: "72px", borderRadius: "12px" }} />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FileText size={26} /></div>
            <div className="empty-state-title">No reports yet</div>
            <p className="empty-state-desc">
              {searchTerm ? `No reports match "${searchTerm}"` : "Upload your first lab report or medical document above."}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Report Date</th>
                  <th>Status</th>
                  <th>Verification</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                        <div style={{
                          width: "32px", height: "32px", borderRadius: "8px",
                          background: "var(--color-brand-50)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          <FileText size={14} color="var(--color-brand-600)" />
                        </div>
                        <div>
                          <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {doc.original_filename}
                          </div>
                          {doc.file_size_bytes && (
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                              {(doc.file_size_bytes / 1024 / 1024).toFixed(1)} MB
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      {doc.document_type ? (
                        <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>
                          {doc.document_type}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                      {doc.report_date ? format(new Date(doc.report_date), "MMM d, yyyy") : "—"}
                    </td>
                    <td><DocStatusBadge status={doc.processing_status} /></td>
                    <td>
                      {doc.processing_status === "ready" ? (
                        <div style={{ fontSize: "0.8rem" }}>
                          <span style={{ fontWeight: 600 }}>{doc.verified_values_count}</span>
                          <span style={{ color: "var(--text-muted)" }}>/{doc.extracted_values_count} verified</span>
                          {doc.verified_values_count < doc.extracted_values_count && (
                            <Link href={`/records/${doc.id}/verify`} style={{ marginLeft: "0.5rem", color: "var(--color-brand-600)", fontWeight: 500 }}>
                              Review
                            </Link>
                          )}
                        </div>
                      ) : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.375rem" }}>
                        <Link href={`/records/${doc.id}`}>
                          <button className="btn btn-ghost btn-sm" title="View"><Eye size={14} /></button>
                        </Link>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDeleteConfirm(doc.id)}
                          style={{ color: "var(--color-error-icon)" }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            background: "white", borderRadius: "16px", padding: "2rem",
            maxWidth: "400px", width: "90%", boxShadow: "var(--shadow-xl)",
          }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.625rem" }}>Delete report?</h3>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              This will permanently delete the document and all extracted metrics. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { className: string; icon: React.ReactNode; label: string }> = {
    ready:   { className: "badge-verified",   icon: <CheckCircle size={10} />,   label: "Ready" },
    failed:  { className: "badge-error",      icon: <AlertTriangle size={10} />, label: "Failed" },
    pending: { className: "badge-neutral",    icon: <Clock size={10} />,         label: "Pending" },
  };
  const config = configs[status] || { className: "badge-neutral", icon: <Clock size={10} />, label: status };
  return <span className={`badge ${config.className}`}>{config.icon}{config.label}</span>;
}
