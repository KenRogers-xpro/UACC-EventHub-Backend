# UACC EventHub Backend

REST API backend for **UACC EventHub** (Uganda Air Cargo Corporation), developed following the official system logic and algorithm documentation (v1.0).

---

## 🛠️ Tech Stack

- **Runtime:** Node.js (v20+)
- **Framework:** Express.js
- **Database:** PostgreSQL (Neon Serverless PostgreSQL)
- **Authentication:** JWT (JSON Web Tokens) with 8-hour expiry & bcrypt password hashing
- **File & Media Storage:** Cloudinary (Materials & Cover images)
- **File Uploads:** Multer (with 10MB limit and file extension validation)

---

## 📂 Project Structure

```
UACC-EventHub-Backend/
├── config/
│   ├── db.js                 # PostgreSQL connection pool (Neon SSL supported)
│   └── cloudinary.js         # Cloudinary configuration
├── controllers/
│   ├── authController.js     # Admin login & profile session check
│   ├── eventController.js    # Event CRUD & RSVP aggregate statistics
│   ├── inviteeController.js  # Add & remove invitees with unique link generation
│   ├── rsvpController.js     # Public guest invitation fetch & RSVP submission
│   └── materialController.js # Event materials upload, guest download & deletion
├── database/
│   ├── schema.sql            # DDL for admins, events, invitees, event_materials
│   ├── migrate.js            # Database migration runner
│   └── seedAdmin.js          # Initial administrator seeding script
├── middleware/
│   ├── auth.js               # JWT verification middleware (verifyAdminToken)
│   └── upload.js             # Multer upload configuration & validation
├── routes/
│   ├── authRoutes.js         # /api/auth routes
│   ├── eventRoutes.js        # /api/events routes
│   ├── inviteeRoutes.js      # /api/invitees routes
│   ├── rsvpRoutes.js         # /api/invite routes
│   └── materialRoutes.js     # /api/materials routes
├── .env.example              # Environment variables template
├── server.js                 # Express application entry point
└── package.json
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your connection details:
```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PORT` | Port for the Express server (default: `5000`) |
| `DATABASE_URL` | Neon PostgreSQL connection string (with `?sslmode=require`) |
| `JWT_SECRET` | Secret key for signing admin authentication tokens |
| `JWT_EXPIRES_IN` | Token expiration time (default: `8h`) |
| `BASE_URL` | Frontend base URL used for invite links (e.g., `http://localhost:5173`) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `INITIAL_ADMIN_EMAIL` | Seed admin email (default: `admin@uacc.go.ug`) |
| `INITIAL_ADMIN_PASSWORD` | Seed admin password |

### 3. Run Database Migration
Execute schema migration against your Neon PostgreSQL database:
```bash
npm run db:migrate
```

### 4. Seed Initial Administrator Account
```bash
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
# or production mode:
npm start
```

---

## 📡 API Endpoints Reference

### 1. Authentication
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Admin login, returns 8-hour JWT token |
| `GET` | `/api/auth/me` | Admin | Get current admin profile & verify token |

### 2. Events (`/api/events`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/events` | Admin | Create new event (validates RSVP deadline < event date) |
| `GET` | `/api/events` | Admin | List all events created by admin with aggregate counts (`total_invited`, `total_accepted`, `total_declined`, `total_pending`) |
| `GET` | `/api/events/:id` | Admin | Get single event details with guests list and materials |
| `PUT` | `/api/events/:id` | Admin | Update event details |
| `DELETE` | `/api/events/:id` | Admin | Delete event, cascades to materials (Cloudinary + DB) and invitees |

### 3. Invitees & Guest Management
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/events/:id/invitees` | Admin | Add guest, generates unique UUID token and `invite_link` |
| `DELETE` | `/api/invitees/:id` | Admin | Remove guest from event |

### 4. RSVP Module (Public — No Login Required)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/invite/:token` | Public | Retrieve event invitation details by token |
| `POST` | `/api/invite/:token/respond` | Public | Submit RSVP response (`accepted` or `declined`) |

### 5. Event Materials
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/events/:id/materials` | Admin | Upload material file (max 10MB; pdf, doc, docx, xls, xlsx, jpg, png) |
| `GET` | `/api/invite/:token/materials`| Public | Fetch downloadable materials (confirmed `accepted` guests only) |
| `DELETE` | `/api/materials/:id` | Admin | Delete material from Cloudinary & DB |

---

## 🔒 Security & Rules Enforced
1. **Password Security:** Salted hashes with `bcryptjs`. Plain text passwords are never stored.
2. **Access Control:** All management routes verify `Bearer <JWT_TOKEN>` in the `Authorization` header and enforce ownership checks (`event.created_by = adminId`).
3. **One-Time RSVP Response:** Guests can only respond once; attempts to re-submit return `409 Conflict`.
4. **Deadline Enforcement:** RSVP submissions after `rsvp_deadline` are blocked with `410 Gone`.
5. **Restricted Downloads:** Materials can only be accessed by invitees whose status is `accepted` (`403 Forbidden` otherwise).
