"use client";
import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { feedbackApi } from "@/lib/api";
import {
  HelpCircle, MessageSquare, Mail, ShieldCheck, ChevronDown, ChevronUp,
  Search, Star, CheckCircle, AlertTriangle, Send, LifeBuoy, FileText, Activity, Bell, Pill, Sparkles
} from "lucide-react";

interface FAQItem {
  id: string;
  category: "reports" | "metrics" | "reminders" | "medications" | "privacy";
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    id: "faq-1",
    category: "reports",
    question: "How do I upload lab reports and medical records?",
    answer: "Go to the 'Health Records' page and click 'Upload Document'. You can drag and drop PDF reports or image files (JPG/PNG). HealthVault AI will automatically parse the document using Gemini Vision OCR and extract all test values, reference ranges, and lab dates."
  },
  {
    id: "faq-2",
    category: "metrics",
    question: "How does HealthVault AI track physiological metric trends over time?",
    answer: "Every extracted value (such as HbA1c, Fasting Blood Sugar, Total Cholesterol, TSH, Vitamin D3) is automatically saved with its measurement date. You can view 1-year progression charts on the 'Health Metrics' page to monitor your health improvements."
  },
  {
    id: "faq-3",
    category: "reminders",
    question: "How do test reminders work, and when will I be notified?",
    answer: "You can create one-time or recurring test reminders (e.g., quarterly HbA1c or annual checkups). Reminders notify you ahead of time (default is 1 day before due date) via in-app alerts and email. Reminders can only be marked completed once the scheduled test date arrives."
  },
  {
    id: "faq-4",
    category: "medications",
    question: "Can I scan my medicine strip, bottle, or prescription packet?",
    answer: "Yes! On the 'Medications' page, click 'Scan Medicine Packet'. Take or upload a photo of your medicine bottle or blister pack. Our Gemini Vision AI will automatically detect the brand name, active chemical composition (generic name), dosage, and manufacturer."
  },
  {
    id: "faq-5",
    category: "privacy",
    question: "Is my medical data secure and private?",
    answer: "Yes! All your medical documents, lab metrics, and medication records are stored in your encrypted local database. Your personal data is never sold or shared with third-party advertisers."
  },
  {
    id: "faq-6",
    category: "metrics",
    question: "Can I manually add or edit a health metric value?",
    answer: "Yes! On the 'Health Metrics' page, click 'Add Entry'. You can manually input any vital sign or lab metric value, set its measurement date, and define standard reference ranges."
  }
];

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<"faqs" | "contact" | "feedback">("faqs");
  const [searchQuery, setSearchQuery] = useState("");
  const [faqCategory, setFaqCategory] = useState<string>("all");
  const [expandedFaq, setExpandedFaq] = useState<string | null>("faq-1");

  const [feedbackType, setFeedbackType] = useState<string>("general");
  const [rating, setRating] = useState<number>(5);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [history, setHistory] = useState<Array<{ id: string; subject: string; feedback_type: string; rating?: number; created_at: string }>>([]);

  const loadHistory = async () => {
    try {
      const res = await feedbackApi.list();
      setHistory(res.data);
    } catch {
      // Ignored if user hasn't submitted
    }
  };

  useEffect(() => {
    if (activeTab === "feedback") {
      loadHistory();
    }
  }, [activeTab]);

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setErrorMsg("Please enter a subject.");
      return;
    }
    if (!message.trim()) {
      setErrorMsg("Please enter your detailed feedback message.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    try {
      await feedbackApi.submit({
        feedback_type: feedbackType,
        rating,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSuccessMsg(true);
      setSubject("");
      setMessage("");
      loadHistory();
      setTimeout(() => setSuccessMsg(false), 5000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredFaqs = FAQS.filter(faq => {
    const matchesCat = faqCategory === "all" || faq.category === faqCategory;
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <AppLayout>
      <div style={{ padding: "2rem 2.5rem", maxWidth: "900px", margin: "0 auto" }}>
        
        {/* Header Banner */}
        <div style={{
          padding: "2rem",
          borderRadius: "16px",
          background: "linear-gradient(135deg, rgba(29, 116, 232, 0.08), rgba(90, 174, 255, 0.12))",
          border: "1px solid rgba(29, 116, 232, 0.2)",
          marginBottom: "2rem",
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
        }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "14px",
            background: "linear-gradient(135deg, #1d74e8, #5aaeff)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", flexShrink: 0,
            boxShadow: "0 8px 16px rgba(29, 116, 232, 0.25)",
          }}>
            <LifeBuoy size={28} />
          </div>
          <div>
            <h1 className="text-h1" style={{ marginBottom: "0.25rem" }}>Help & Support Center</h1>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", margin: 0 }}>
              Find guides, contact support, or send us your feedback to improve HealthVault AI.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: "flex", gap: "0.5rem", marginBottom: "2rem",
          borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem"
        }}>
          <button
            onClick={() => setActiveTab("faqs")}
            className={`btn ${activeTab === "faqs" ? "btn-primary" : "btn-secondary"}`}
            style={{ borderRadius: "10px", padding: "0.5rem 1.25rem" }}
          >
            <HelpCircle size={16} /> Help & FAQs
          </button>
          <button
            onClick={() => setActiveTab("contact")}
            className={`btn ${activeTab === "contact" ? "btn-primary" : "btn-secondary"}`}
            style={{ borderRadius: "10px", padding: "0.5rem 1.25rem" }}
          >
            <Mail size={16} /> Contact Us
          </button>
          <button
            onClick={() => setActiveTab("feedback")}
            className={`btn ${activeTab === "feedback" ? "btn-primary" : "btn-secondary"}`}
            style={{ borderRadius: "10px", padding: "0.5rem 1.25rem" }}
          >
            <MessageSquare size={16} /> Send Feedback
          </button>
        </div>

        {/* TAB 1: FAQs */}
        {activeTab === "faqs" && (
          <div>
            {/* Search & Category Filter */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
                <Search size={18} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  type="text"
                  className="input"
                  style={{ paddingLeft: "2.75rem" }}
                  placeholder="Search questions or topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.375rem" }}>
                {[
                  { id: "all", label: "All Topics" },
                  { id: "reports", label: "Reports" },
                  { id: "metrics", label: "Metrics" },
                  { id: "reminders", label: "Reminders" },
                  { id: "medications", label: "Meds" },
                  { id: "privacy", label: "Privacy" },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setFaqCategory(cat.id)}
                    style={{
                      padding: "0.4rem 0.85rem",
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      border: "1px solid",
                      cursor: "pointer",
                      borderColor: faqCategory === cat.id ? "var(--color-brand-500)" : "var(--border-color)",
                      background: faqCategory === cat.id ? "rgba(29, 116, 232, 0.1)" : "var(--surface-card)",
                      color: faqCategory === cat.id ? "var(--color-brand-600)" : "var(--text-secondary)",
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Accordion FAQ List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {filteredFaqs.length > 0 ? (
                filteredFaqs.map(faq => {
                  const isOpen = expandedFaq === faq.id;
                  return (
                    <div
                      key={faq.id}
                      className="card"
                      style={{
                        borderRadius: "12px",
                        overflow: "hidden",
                        border: isOpen ? "1px solid var(--color-brand-400)" : "1px solid var(--border-color)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <button
                        onClick={() => toggleFaq(faq.id)}
                        style={{
                          width: "100%",
                          padding: "1.1rem 1.25rem",
                          background: "none",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          textAlign: "left",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "0.95rem",
                          color: "var(--text-primary)",
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                          <HelpCircle size={18} color="var(--color-brand-500)" />
                          {faq.question}
                        </span>
                        {isOpen ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                      </button>

                      {isOpen && (
                        <div style={{
                          padding: "0 1.25rem 1.25rem 2.75rem",
                          fontSize: "0.875rem",
                          color: "var(--text-secondary)",
                          lineHeight: 1.65,
                          borderTop: "1px solid var(--border-color)",
                          paddingTop: "0.875rem",
                          background: "var(--color-neutral-50)",
                        }}>
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="card" style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                  No matching help questions found. Try searching with a different word or select All Topics.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Contact Us */}
        {activeTab === "contact" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            {/* Contact Cards Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }}>
              <div className="card" style={{ padding: "1.5rem", borderRadius: "14px" }}>
                <div style={{
                  width: "42px", height: "42px", borderRadius: "10px",
                  background: "rgba(29, 116, 232, 0.1)", color: "var(--color-brand-600)",
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem"
                }}>
                  <Mail size={22} />
                </div>
                <h3 className="text-h4" style={{ marginBottom: "0.375rem" }}>Support Email</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.875rem" }}>
                  For technical assistance, account inquiries, or data questions.
                </p>
                <a href="mailto:support@healthvault.ai" style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--color-brand-600)" }}>
                  support@healthvault.ai
                </a>
              </div>

              <div className="card" style={{ padding: "1.5rem", borderRadius: "14px" }}>
                <div style={{
                  width: "42px", height: "42px", borderRadius: "10px",
                  background: "rgba(16, 185, 129, 0.1)", color: "#10b981",
                  display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem"
                }}>
                  <ShieldCheck size={22} />
                </div>
                <h3 className="text-h4" style={{ marginBottom: "0.375rem" }}>Response SLA</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.875rem" }}>
                  Guaranteed response time from our clinical support team.
                </p>
                <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#10b981" }}>
                  Within 24 Hours
                </span>
              </div>
            </div>

            {/* Emergency & Privacy Disclaimer */}
            <div style={{
              padding: "1.25rem 1.5rem",
              borderRadius: "12px",
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              display: "flex",
              alignItems: "flex-start",
              gap: "1rem"
            }}>
              <AlertTriangle size={22} color="#d97706" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
              <div>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#b45309", marginBottom: "0.25rem" }}>
                  Important Medical Privacy & Emergency Disclaimer
                </h4>
                <p style={{ fontSize: "0.825rem", color: "var(--text-secondary)", lineHeight: 1.55, margin: 0 }}>
                  HealthVault AI is a personal health tracking and AI lab report organization platform. It does not provide emergency medical treatment. If you are experiencing a medical emergency, acute chest pain, or severe shortness of breath, please call your local emergency services (e.g. 112 / 911) immediately.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: Feedback Form */}
        {activeTab === "feedback" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            
            <div className="card" style={{ padding: "2rem", borderRadius: "16px" }}>
              <h2 className="text-h3" style={{ marginBottom: "0.5rem" }}>Share Your Feedback</h2>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                Tell us what you love or how we can improve your HealthVault AI experience.
              </p>

              {successMsg && (
                <div style={{
                  padding: "1rem 1.25rem",
                  borderRadius: "10px",
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#065f46",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "1.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem"
                }}>
                  <CheckCircle size={18} /> Thank you! Your feedback has been submitted successfully.
                </div>
              )}

              {errorMsg && (
                <div style={{
                  padding: "1rem 1.25rem",
                  borderRadius: "10px",
                  background: "var(--color-error-bg)",
                  border: "1px solid var(--color-error-border)",
                  color: "var(--color-error-text)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "1.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem"
                }}>
                  <AlertTriangle size={18} /> {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmitFeedback}>
                
                {/* Rating Stars */}
                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                  <label className="label" style={{ marginBottom: "0.5rem" }}>How would you rate your overall experience?</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "0.25rem",
                          transition: "transform 0.15s ease",
                        }}
                      >
                        <Star
                          size={28}
                          fill={star <= rating ? "#f59e0b" : "none"}
                          color={star <= rating ? "#f59e0b" : "var(--text-muted)"}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback Type Category Pills */}
                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                  <label className="label" style={{ marginBottom: "0.5rem" }}>Category</label>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {[
                      { id: "general", label: "💬 General Feedback" },
                      { id: "bug", label: "🐛 Report a Bug" },
                      { id: "feature_request", label: "✨ Feature Request" },
                      { id: "data_issue", label: "📊 OCR / Data Issue" },
                      { id: "question", label: "❓ Question" },
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setFeedbackType(type.id)}
                        style={{
                          padding: "0.5rem 1rem",
                          borderRadius: "8px",
                          fontSize: "0.825rem",
                          fontWeight: 600,
                          border: "1px solid",
                          cursor: "pointer",
                          borderColor: feedbackType === type.id ? "var(--color-brand-500)" : "var(--border-color)",
                          background: feedbackType === type.id ? "rgba(29, 116, 232, 0.1)" : "var(--surface-card)",
                          color: feedbackType === type.id ? "var(--color-brand-600)" : "var(--text-secondary)",
                        }}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                  <label className="label" htmlFor="fb-subject">Subject</label>
                  <input
                    id="fb-subject"
                    className="input"
                    placeholder="e.g. OCR accuracy for HbA1c lab report"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                {/* Message */}
                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                  <label className="label" htmlFor="fb-message">Message Details</label>
                  <textarea
                    id="fb-message"
                    className="input"
                    rows={4}
                    placeholder="Please describe your experience, request, or issue in detail..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ borderRadius: "10px", padding: "0.625rem 1.75rem" }}
                >
                  <Send size={16} />
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </button>
              </form>
            </div>

            {/* Submitted Feedback History */}
            {history.length > 0 && (
              <div className="card" style={{ padding: "1.75rem", borderRadius: "16px" }}>
                <h3 className="text-h4" style={{ marginBottom: "1rem" }}>Your Previous Feedback Submissions</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {history.map((item) => (
                    <div key={item.id} style={{
                      padding: "1rem 1.25rem",
                      borderRadius: "10px",
                      background: "var(--color-neutral-50)",
                      border: "1px solid var(--border-color)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}>
                      <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                          {item.subject}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                          Type: <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{item.feedback_type}</span> • Submitted: {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {item.rating && (
                        <div style={{ display: "flex", gap: "0.15rem" }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} size={14} fill={s <= item.rating! ? "#f59e0b" : "none"} color={s <= item.rating! ? "#f59e0b" : "#cbd5e1"} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </AppLayout>
  );
}
