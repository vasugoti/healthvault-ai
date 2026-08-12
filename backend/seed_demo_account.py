"""
Seed script to create a demo user account populated with 1 year of realistic health data.
Account Credentials:
Email: demo@healthvault.ai
Password: Password123!
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, delete

from app.database import AsyncSessionLocal, engine
from app.models import (
    User, Document, Metric, Medication, Reminder, TimelineEvent,
    ProcessingStatus, DocumentType, VerificationStatus, TimelineEventType
)
from app.auth import hash_password


DEMO_EMAIL = "demo@healthvault.ai"
DEMO_PASSWORD = "Password123!"
DEMO_NAME = "Alex Mercer"


async def seed_data():
    async with AsyncSessionLocal() as session:
        # Check if user exists
        stmt = select(User).where(User.email == DEMO_EMAIL)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()

        if user:
            print(f"User {DEMO_EMAIL} already exists (ID: {user.id}). Re-seeding data...")
            # Clean up existing data for this user
            await session.execute(delete(Metric).where(Metric.user_id == user.id))
            await session.execute(delete(Document).where(Document.user_id == user.id))
            await session.execute(delete(Medication).where(Medication.user_id == user.id))
            await session.execute(delete(Reminder).where(Reminder.user_id == user.id))
            await session.execute(delete(TimelineEvent).where(TimelineEvent.user_id == user.id))
            await session.commit()
        else:
            print(f"Creating new demo user {DEMO_EMAIL}...")
            user = User(
                id=uuid.uuid4(),
                email=DEMO_EMAIL,
                password_hash=hash_password(DEMO_PASSWORD),
                full_name=DEMO_NAME,
                date_of_birth=datetime(1988, 5, 15, tzinfo=timezone.utc),
                sex="Male",
                user_entered_conditions=["Pre-Diabetes", "Mild Hyperlipidemia", "Vitamin D Deficiency"],
                notification_email=DEMO_EMAIL,
                is_active=True,
                created_at=datetime(2025, 8, 1, tzinfo=timezone.utc),
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)

        user_id = user.id

        # -------------------------------------------------------------------
        # 1. Create Documents across the last 1 year (Aug 2025 - Jul 2026)
        # -------------------------------------------------------------------
        docs_def = [
            {
                "filename": "Comprehensive_Blood_Panel_Aug2025.pdf",
                "doc_type": DocumentType.BLOOD,
                "report_date": datetime(2025, 8, 15, 10, 30, tzinfo=timezone.utc),
                "lab_name": "Quest Diagnostics Central Lab",
                "doctor_name": "Dr. Sarah Jenkins, MD",
                "page_count": 3,
            },
            {
                "filename": "HbA1c_Fasting_Glucose_Nov2025.pdf",
                "doc_type": DocumentType.DIABETES,
                "report_date": datetime(2025, 11, 20, 9, 15, tzinfo=timezone.utc),
                "lab_name": "LabCorp Health Services",
                "doctor_name": "Dr. Sarah Jenkins, MD",
                "page_count": 2,
            },
            {
                "filename": "Lipid_Thyroid_Panel_Feb2026.pdf",
                "doc_type": DocumentType.LIPID,
                "report_date": datetime(2026, 2, 14, 11, 0, tzinfo=timezone.utc),
                "lab_name": "Quest Diagnostics Central Lab",
                "doctor_name": "Dr. Sarah Jenkins, MD",
                "page_count": 2,
            },
            {
                "filename": "Quarterly_Diabetes_CBC_May2026.pdf",
                "doc_type": DocumentType.DIABETES,
                "report_date": datetime(2026, 5, 10, 8, 45, tzinfo=timezone.utc),
                "lab_name": "LabCorp Health Services",
                "doctor_name": "Dr. Sarah Jenkins, MD",
                "page_count": 2,
            },
            {
                "filename": "Annual_Wellness_Checkup_Jul2026.pdf",
                "doc_type": DocumentType.BLOOD,
                "report_date": datetime(2026, 7, 22, 10, 0, tzinfo=timezone.utc),
                "lab_name": "Mayo Clinic Health Network",
                "doctor_name": "Dr. Robert Vance, FACP",
                "page_count": 4,
            },
        ]

        documents = []
        for d in docs_def:
            doc = Document(
                id=uuid.uuid4(),
                user_id=user_id,
                original_filename=d["filename"],
                storage_path=f"demo/{d['filename']}",
                file_size_bytes=1024 * 450,
                mime_type="application/pdf",
                document_type=d["doc_type"],
                processing_status=ProcessingStatus.READY,
                report_date=d["report_date"],
                lab_name=d["lab_name"],
                doctor_name=d["doctor_name"],
                page_count=d["page_count"],
                extracted_values_count=7,
                verified_values_count=7,
                created_at=d["report_date"] + timedelta(hours=2),
            )
            session.add(doc)
            documents.append(doc)

        await session.commit()
        for doc in documents:
            await session.refresh(doc)

        doc_aug, doc_nov, doc_feb, doc_may, doc_jul = documents

        # -------------------------------------------------------------------
        # 2. Extracted Health Metrics (Progression over 1 year)
        # -------------------------------------------------------------------
        metrics_data = [
            # === Aug 2025 Report (Baseline — elevated risk) ===
            {
                "doc": doc_aug,
                "name": "Fasting Blood Sugar",
                "category": "diabetes",
                "val": 118.0,
                "unit": "mg/dL",
                "low": 70.0,
                "high": 99.0,
                "date": doc_aug.report_date,
                "notes": "Elevated fasting glucose detected",
            },
            {
                "doc": doc_aug,
                "name": "HbA1c",
                "category": "diabetes",
                "val": 6.4,
                "unit": "%",
                "low": 4.0,
                "high": 5.6,
                "date": doc_aug.report_date,
                "notes": "Pre-diabetes range (5.7 - 6.4%)",
            },
            {
                "doc": doc_aug,
                "name": "Total Cholesterol",
                "category": "lipid",
                "val": 228.0,
                "unit": "mg/dL",
                "low": 125.0,
                "high": 200.0,
                "date": doc_aug.report_date,
                "notes": "Elevated cholesterol level",
            },
            {
                "doc": doc_aug,
                "name": "LDL Cholesterol",
                "category": "lipid",
                "val": 145.0,
                "unit": "mg/dL",
                "low": 0.0,
                "high": 100.0,
                "date": doc_aug.report_date,
                "notes": "Borderline high LDL",
            },
            {
                "doc": doc_aug,
                "name": "HDL Cholesterol",
                "category": "lipid",
                "val": 42.0,
                "unit": "mg/dL",
                "low": 40.0,
                "high": 60.0,
                "date": doc_aug.report_date,
                "notes": "Low-normal HDL",
            },
            {
                "doc": doc_aug,
                "name": "Triglycerides",
                "category": "lipid",
                "val": 190.0,
                "unit": "mg/dL",
                "low": 0.0,
                "high": 150.0,
                "date": doc_aug.report_date,
                "notes": "Elevated triglycerides",
            },
            {
                "doc": doc_aug,
                "name": "Vitamin D (25-OH)",
                "category": "vitamin",
                "val": 18.5,
                "unit": "ng/mL",
                "low": 30.0,
                "high": 100.0,
                "date": doc_aug.report_date,
                "notes": "Vitamin D deficiency (<20 ng/mL)",
            },
            {
                "doc": doc_aug,
                "name": "Hemoglobin",
                "category": "blood",
                "val": 14.8,
                "unit": "g/dL",
                "low": 13.5,
                "high": 17.5,
                "date": doc_aug.report_date,
                "notes": "Normal blood count",
            },

            # === Nov 2025 Follow-up (Initial improvement after Metformin & D3) ===
            {
                "doc": doc_nov,
                "name": "Fasting Blood Sugar",
                "category": "diabetes",
                "val": 112.0,
                "unit": "mg/dL",
                "low": 70.0,
                "high": 99.0,
                "date": doc_nov.report_date,
                "notes": "Decreasing trend observed",
            },
            {
                "doc": doc_nov,
                "name": "HbA1c",
                "category": "diabetes",
                "val": 6.1,
                "unit": "%",
                "low": 4.0,
                "high": 5.6,
                "date": doc_nov.report_date,
                "notes": "Improved by 0.3%",
            },
            {
                "doc": doc_nov,
                "name": "Vitamin D (25-OH)",
                "category": "vitamin",
                "val": 28.0,
                "unit": "ng/mL",
                "low": 30.0,
                "high": 100.0,
                "date": doc_nov.report_date,
                "notes": "Approaching normal range",
            },

            # === Feb 2026 Follow-up (Continued progress) ===
            {
                "doc": doc_feb,
                "name": "Fasting Blood Sugar",
                "category": "diabetes",
                "val": 105.0,
                "unit": "mg/dL",
                "low": 70.0,
                "high": 99.0,
                "date": doc_feb.report_date,
                "notes": "Significant reduction",
            },
            {
                "doc": doc_feb,
                "name": "HbA1c",
                "category": "diabetes",
                "val": 5.8,
                "unit": "%",
                "low": 4.0,
                "high": 5.6,
                "date": doc_feb.report_date,
                "notes": "Near normal cutoff",
            },
            {
                "doc": doc_feb,
                "name": "Total Cholesterol",
                "category": "lipid",
                "val": 210.0,
                "unit": "mg/dL",
                "low": 125.0,
                "high": 200.0,
                "date": doc_feb.report_date,
                "notes": "Down from 228",
            },
            {
                "doc": doc_feb,
                "name": "LDL Cholesterol",
                "category": "lipid",
                "val": 130.0,
                "unit": "mg/dL",
                "low": 0.0,
                "high": 100.0,
                "date": doc_feb.report_date,
                "notes": "Improved LDL",
            },
            {
                "doc": doc_feb,
                "name": "HDL Cholesterol",
                "category": "lipid",
                "val": 46.0,
                "unit": "mg/dL",
                "low": 40.0,
                "high": 60.0,
                "date": doc_feb.report_date,
                "notes": "Increased good cholesterol",
            },
            {
                "doc": doc_feb,
                "name": "Triglycerides",
                "category": "lipid",
                "val": 165.0,
                "unit": "mg/dL",
                "low": 0.0,
                "high": 150.0,
                "date": doc_feb.report_date,
                "notes": "Reduced triglycerides",
            },
            {
                "doc": doc_feb,
                "name": "TSH",
                "category": "thyroid",
                "val": 2.1,
                "unit": "uIU/mL",
                "low": 0.4,
                "high": 4.0,
                "date": doc_feb.report_date,
                "notes": "Optimal thyroid function",
            },

            # === May 2026 Quarterly Test ===
            {
                "doc": doc_may,
                "name": "Fasting Blood Sugar",
                "category": "diabetes",
                "val": 98.0,
                "unit": "mg/dL",
                "low": 70.0,
                "high": 99.0,
                "date": doc_may.report_date,
                "notes": "Normal fasting blood sugar achieved!",
            },
            {
                "doc": doc_may,
                "name": "HbA1c",
                "category": "diabetes",
                "val": 5.6,
                "unit": "%",
                "low": 4.0,
                "high": 5.6,
                "date": doc_may.report_date,
                "notes": "Normal HbA1c achieved (< 5.7%)",
            },
            {
                "doc": doc_may,
                "name": "Hemoglobin",
                "category": "blood",
                "val": 15.2,
                "unit": "g/dL",
                "low": 13.5,
                "high": 17.5,
                "date": doc_may.report_date,
                "notes": "Normal hemoglobin",
            },

            # === Jul 2026 Annual Wellness (Fully Healthy Outcome) ===
            {
                "doc": doc_jul,
                "name": "Fasting Blood Sugar",
                "category": "diabetes",
                "val": 95.0,
                "unit": "mg/dL",
                "low": 70.0,
                "high": 99.0,
                "date": doc_jul.report_date,
                "notes": "Optimal glucose",
            },
            {
                "doc": doc_jul,
                "name": "HbA1c",
                "category": "diabetes",
                "val": 5.5,
                "unit": "%",
                "low": 4.0,
                "high": 5.6,
                "date": doc_jul.report_date,
                "notes": "Sustained normal HbA1c",
            },
            {
                "doc": doc_jul,
                "name": "Total Cholesterol",
                "category": "lipid",
                "val": 192.0,
                "unit": "mg/dL",
                "low": 125.0,
                "high": 200.0,
                "date": doc_jul.report_date,
                "notes": "Desirable level (<200 mg/dL)",
            },
            {
                "doc": doc_jul,
                "name": "LDL Cholesterol",
                "category": "lipid",
                "val": 115.0,
                "unit": "mg/dL",
                "low": 0.0,
                "high": 100.0,
                "date": doc_jul.report_date,
                "notes": "Near optimal LDL",
            },
            {
                "doc": doc_jul,
                "name": "HDL Cholesterol",
                "category": "lipid",
                "val": 52.0,
                "unit": "mg/dL",
                "low": 40.0,
                "high": 60.0,
                "date": doc_jul.report_date,
                "notes": "Healthy protective HDL",
            },
            {
                "doc": doc_jul,
                "name": "Triglycerides",
                "category": "lipid",
                "val": 140.0,
                "unit": "mg/dL",
                "low": 0.0,
                "high": 150.0,
                "date": doc_jul.report_date,
                "notes": "Normal triglycerides (<150 mg/dL)",
            },
            {
                "doc": doc_jul,
                "name": "Vitamin D (25-OH)",
                "category": "vitamin",
                "val": 42.0,
                "unit": "ng/mL",
                "low": 30.0,
                "high": 100.0,
                "date": doc_jul.report_date,
                "notes": "Optimal Vitamin D level",
            },
            {
                "doc": doc_jul,
                "name": "TSH",
                "category": "thyroid",
                "val": 2.2,
                "unit": "uIU/mL",
                "low": 0.4,
                "high": 4.0,
                "date": doc_jul.report_date,
                "notes": "Normal TSH",
            },
            {
                "doc": doc_jul,
                "name": "Vitamin B12",
                "category": "vitamin",
                "val": 450.0,
                "unit": "pg/mL",
                "low": 200.0,
                "high": 900.0,
                "date": doc_jul.report_date,
                "notes": "Normal B12 level",
            },
        ]

        for m in metrics_data:
            metric = Metric(
                id=uuid.uuid4(),
                user_id=user_id,
                document_id=m["doc"].id,
                metric_name=m["name"],
                metric_category=m["category"],
                value=m["val"],
                unit=m["unit"],
                raw_value=str(m["val"]),
                raw_unit=m["unit"],
                measured_at=m["date"],
                reference_range_low=m["low"],
                reference_range_high=m["high"],
                reference_range_unit=m["unit"],
                confidence_score=0.98,
                verification_status=VerificationStatus.VERIFIED,
                verified_at=m["date"] + timedelta(days=1),
                notes=m["notes"],
                created_at=m["date"],
            )
            session.add(metric)

        # -------------------------------------------------------------------
        # 3. Medications (Active & Discontinued)
        # -------------------------------------------------------------------
        meds_data = [
            {
                "name": "Metformin Hydrochloride",
                "category": "diabetes",
                "dosage": "500 mg",
                "frequency": "Once Daily (After Meals)",
                "status": "active",
                "started": datetime(2025, 8, 20, tzinfo=timezone.utc),
                "ended": None,
                "doctor": "Dr. Sarah Jenkins, MD",
                "generic": "Metformin",
                "notes": "Prescribed for glucose regulation following Aug 2025 pre-diabetes screening.",
            },
            {
                "name": "Atorvastatin Calcium",
                "category": "lipid",
                "dosage": "10 mg",
                "frequency": "Once Daily (At Bedtime)",
                "status": "active",
                "started": datetime(2025, 8, 20, tzinfo=timezone.utc),
                "ended": None,
                "doctor": "Dr. Sarah Jenkins, MD",
                "generic": "Atorvastatin",
                "notes": "Lipid management therapy.",
            },
            {
                "name": "Cholecalciferol High Potency",
                "category": "vitamin",
                "dosage": "60,000 IU",
                "frequency": "Once Weekly (for 8 Weeks)",
                "status": "discontinued",
                "started": datetime(2025, 8, 25, tzinfo=timezone.utc),
                "ended": datetime(2025, 10, 20, tzinfo=timezone.utc),
                "doctor": "Dr. Sarah Jenkins, MD",
                "generic": "Vitamin D3",
                "notes": "Initial booster dose for severe deficiency. Switched to daily maintenance.",
            },
            {
                "name": "Vitamin D3 Daily Maintenance",
                "category": "vitamin",
                "dosage": "2,000 IU",
                "frequency": "Once Daily",
                "status": "active",
                "started": datetime(2025, 10, 21, tzinfo=timezone.utc),
                "ended": None,
                "doctor": "Dr. Sarah Jenkins, MD",
                "generic": "Cholecalciferol",
                "notes": "Daily maintenance dose to sustain 40+ ng/mL vitamin D.",
            },
        ]

        for md in meds_data:
            med = Medication(
                id=uuid.uuid4(),
                user_id=user_id,
                name=md["name"],
                category=md["category"],
                dosage=md["dosage"],
                frequency=md["frequency"],
                status=md["status"],
                started_at=md["started"],
                ended_at=md["ended"],
                prescribing_doctor=md["doctor"],
                generic_name=md["generic"],
                notes=md["notes"],
                created_at=md["started"],
            )
            session.add(med)

        # -------------------------------------------------------------------
        # 4. Reminders (Recurring & One-time with Notification Lead Time)
        # -------------------------------------------------------------------
        reminders_data = [
            {
                "title": "HbA1c Diabetes Follow-up Panel",
                "category": "diabetes",
                "type": "recurring",
                "val": 3,
                "unit": "months",
                "next_due": datetime(2026, 10, 20, 9, 0, tzinfo=timezone.utc),
                "last_done": datetime(2026, 7, 22, tzinfo=timezone.utc),
                "notes": "Routine quarterly HbA1c monitoring test.",
                "notify_before": 1,
            },
            {
                "title": "Fasting Blood Glucose Test",
                "category": "diabetes",
                "type": "recurring",
                "val": 1,
                "unit": "months",
                "next_due": datetime(2026, 9, 1, 8, 0, tzinfo=timezone.utc),
                "last_done": datetime(2026, 7, 22, tzinfo=timezone.utc),
                "notes": "10-hour fasting required before lab appointment.",
                "notify_before": 1,
            },
            {
                "title": "Lipid & Cholesterol Profile Follow-up",
                "category": "lipid",
                "type": "recurring",
                "val": 6,
                "unit": "months",
                "next_due": datetime(2027, 1, 20, 10, 0, tzinfo=timezone.utc),
                "last_done": datetime(2026, 7, 22, tzinfo=timezone.utc),
                "notes": "Annual lipid panel reassessment.",
                "notify_before": 2,
            },
            {
                "title": "Annual Executive Health Checkup",
                "category": "doctor_visit",
                "type": "recurring",
                "val": 1,
                "unit": "years",
                "next_due": datetime(2027, 7, 22, 10, 0, tzinfo=timezone.utc),
                "last_done": datetime(2026, 7, 22, tzinfo=timezone.utc),
                "notes": "Comprehensive annual exam with Dr. Vance.",
                "notify_before": 7,
            },
        ]

        for r_item in reminders_data:
            rem = Reminder(
                id=uuid.uuid4(),
                user_id=user_id,
                title=r_item["title"],
                category=r_item["category"],
                reminder_type=r_item["type"],
                frequency_value=r_item["val"],
                frequency_unit=r_item["unit"],
                next_due_date=r_item["next_due"],
                last_completed_date=r_item["last_done"],
                notes=r_item["notes"],
                notify_before_days=r_item["notify_before"],
                is_active=True,
                created_at=datetime(2025, 8, 15, tzinfo=timezone.utc),
            )
            session.add(rem)

        # -------------------------------------------------------------------
        # 5. Timeline Events (1-Year History Stream)
        # -------------------------------------------------------------------
        timeline_items = [
            {
                "type": TimelineEventType.ACCOUNT_CREATED,
                "title": "Account Created",
                "desc": "Alex Mercer created HealthVault AI account.",
                "time": datetime(2025, 8, 1, 9, 0, tzinfo=timezone.utc),
            },
            {
                "type": TimelineEventType.DOCUMENT_UPLOADED,
                "title": "Document Uploaded",
                "desc": "Uploaded 'Comprehensive_Blood_Panel_Aug2025.pdf'",
                "time": datetime(2025, 8, 15, 10, 30, tzinfo=timezone.utc),
            },
            {
                "type": TimelineEventType.METRIC_EXTRACTED,
                "title": "Health Metrics Extracted",
                "desc": "Extracted 8 health metrics including HbA1c (6.4%) and Fasting Glucose (118 mg/dL).",
                "time": datetime(2025, 8, 15, 10, 32, tzinfo=timezone.utc),
            },
            {
                "type": TimelineEventType.MEDICATION_ADDED,
                "title": "Medication Started: Metformin 500mg",
                "desc": "Prescribed by Dr. Sarah Jenkins for glucose control.",
                "time": datetime(2025, 8, 20, 14, 0, tzinfo=timezone.utc),
            },
            {
                "type": TimelineEventType.MEDICATION_ADDED,
                "title": "Medication Started: Vitamin D3 60,000 IU",
                "desc": "Weekly booster dose started for Vitamin D deficiency (18.5 ng/mL).",
                "time": datetime(2025, 8, 25, 10, 0, tzinfo=timezone.utc),
            },
            {
                "type": TimelineEventType.DOCUMENT_UPLOADED,
                "title": "Document Uploaded",
                "desc": "Uploaded 'HbA1c_Fasting_Glucose_Nov2025.pdf'",
                "time": datetime(2025, 11, 20, 9, 15, tzinfo=timezone.utc),
            },
            {
                "type": TimelineEventType.METRIC_VERIFIED,
                "title": "Metric Trend Improved: HbA1c",
                "desc": "HbA1c decreased from 6.4% to 6.1%.",
                "time": datetime(2025, 11, 20, 9, 30, tzinfo=timezone.utc),
            },
            {
                "type": TimelineEventType.DOCUMENT_UPLOADED,
                "title": "Document Uploaded",
                "desc": "Uploaded 'Lipid_Thyroid_Panel_Feb2026.pdf'",
                "time": datetime(2026, 2, 14, 11, 0, tzinfo=timezone.utc),
            },
            {
                "type": TimelineEventType.METRIC_VERIFIED,
                "title": "Metric Trend Improved: Cholesterol & Glucose",
                "desc": "Total Cholesterol reduced to 210 mg/dL; Fasting Glucose reduced to 105 mg/dL.",
                "time": datetime(2026, 2, 14, 11, 15, tzinfo=timezone.utc),
            },
            {
                "type": TimelineEventType.DOCUMENT_UPLOADED,
                "title": "Document Uploaded",
                "desc": "Uploaded 'Quarterly_Diabetes_CBC_May2026.pdf'",
                "time": datetime(2026, 5, 10, 8, 45, tzinfo=timezone.utc),
            },
            {
                "type": TimelineEventType.METRIC_VERIFIED,
                "title": "🎉 Health Goal Achieved: Normal Glucose & HbA1c",
                "desc": "HbA1c reached 5.6% and Fasting Sugar reached 98 mg/dL (Normal Healthy Range).",
                "time": datetime(2026, 5, 10, 9, 0, tzinfo=timezone.utc),
            },
            {
                "type": TimelineEventType.DOCUMENT_UPLOADED,
                "title": "Document Uploaded",
                "desc": "Uploaded 'Annual_Wellness_Checkup_Jul2026.pdf'",
                "time": datetime(2026, 7, 22, 10, 0, tzinfo=timezone.utc),
            },
            {
                "type": TimelineEventType.PROFILE_UPDATED,
                "title": "Annual Health Summary Generated",
                "desc": "All metabolic and lipid panels verified within normal physiological limits.",
                "time": datetime(2026, 7, 22, 10, 30, tzinfo=timezone.utc),
            },
        ]

        for t_item in timeline_items:
            t_evt = TimelineEvent(
                id=uuid.uuid4(),
                user_id=user_id,
                event_type=t_item["type"],
                title=t_item["title"],
                description=t_item["desc"],
                occurred_at=t_item["time"],
                created_at=t_item["time"],
            )
            session.add(t_evt)

        await session.commit()
        print(f"\n=======================================================")
        print(f"[SUCCESS] POPULATED 1 YEAR OF DEMO HEALTH DATA!")
        print(f"=======================================================")
        print(f"Email:       {DEMO_EMAIL}")
        print(f"Password:    {DEMO_PASSWORD}")
        print(f"Name:        {DEMO_NAME}")
        print(f"Reports:     5 documents across Aug 2025 - Jul 2026")
        print(f"Metrics:     30+ trend values (HbA1c, Sugar, Cholesterol, D3, etc.)")
        print(f"Meds:        4 medications (Metformin, Atorvastatin, D3)")
        print(f"Alerts:      4 scheduled reminders (with 1-day default alerts)")
        print(f"=======================================================\n")


if __name__ == "__main__":
    asyncio.run(seed_data())
