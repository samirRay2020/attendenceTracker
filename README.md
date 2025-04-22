# 📊 Zoom Attendance Tracker with Google Sheets Integration

This project is a **Node.js-based web application** that automates attendance tracking for Zoom meetings. It captures participant join/leave events, calculates their attendance duration, and logs it in a **Google Spreadsheet** using the **Google Sheets API**. The application includes **user authentication**, **MongoDB integration**, and **session handling**.

---

## 🚀 Features

- ✅ User Registration & Login using Passport.js
- ✅ Google Spreadsheet creation & sharing for each Zoom meeting
- ✅ Real-time logging of Zoom meeting attendance
- ✅ Duration-based attendance marking (e.g., Present if above a threshold)
- ✅ Data stored in MongoDB for meetings and participants
- ✅ Google Drive & Sheets integration via OAuth2
- ✅ RESTful API endpoints for Zoom webhooks

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB, Mongoose
- **Authentication:** Passport.js, express-session
- **External APIs:** Google Sheets API, Google Drive API, Zoom API
- **Other Tools:** dotenv, body-parser, memorystore

---


---

## ⚙️ How It Works

### 1. User Authentication

- Users register or log in via `/register` and `/`
- Authenticated users are redirected to `/mainpage`

### 2. Host Creates a Meeting

- A new Google Spreadsheet is created
- Access permissions are set to "anyone with the link"
- The spreadsheet is initialized with columns: `name`, `email`, `duration`, `status`

### 3. Zoom Webhook Integration

- When a user joins the Zoom meeting:
  - Their name, email, and join time are stored
- When a user leaves:
  - Their attendance duration is calculated
  - If the time exceeds the threshold, they are marked as "Present"

---

## 📦 Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-username/zoom-attendance-tracker.git
   cd zoom-attendance-tracker
   
📌 Notes
You must enable the Zoom Webhook App and point it to /studententer and /studentleave endpoints.

