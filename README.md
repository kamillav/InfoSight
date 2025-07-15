# 📊 InfoSight – Team Impact Intelligence Platform

Infosight is an AI-powered internal tool for Infosys designed to collect, analyze, and visualize qualitative video reflections from team leads. It enables leadership to extract key business insights, track KPI alignment, and assess team sentiment through a simple, scalable interface.

---

## 🚀 Features

- ✅ **Secure login system** for team leads and admins
- 📹 **Video upload interface** (max ~100MB, ~2-minute reflections)
- 🧠 **Automatic transcription** using OpenAI Whisper API
- 🧾 **LLM-powered insight extraction** (themes, KPIs, sentiment, quotes)
- 📊 **Interactive dashboards** for:
  - Team-level impact tracking
  - Admin-level performance summaries
  - Word clouds, bar charts, sentiment trends
- 🧩 Modular, editable architecture using [Lovable.dev](https://lovable.dev)

---

## 🧱 Tech Stack

- **Frontend:** React / Next.js (generated via Lovable.dev)
- **Backend:** Node.js (API routes auto-generated)
- **AI Integration:** OpenAI Whisper + GPT-4 API
- **Storage:** Cloudinary or Local (depending on hosting)
- **Authentication:** Built-in email/password (customizable)
- **Visualization:** Chart.js / WordCloud.js components

---

## 📂 Project Structure

```bash
infosight/
├── components/        # UI elements (upload, dashboard)
├── pages/             # Frontend routes (login, dashboard, admin)
├── api/               # Video processing, transcript, analysis
├── public/            # Assets (logo, icons)
├── styles/            # Global and component-level styles
├── utils/             # Helper functions
└── .env.local         # API keys (Whisper, OpenAI, etc.)
