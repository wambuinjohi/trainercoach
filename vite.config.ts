import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// Load .env variables
const mode = process.env.NODE_ENV || "development";
const env = loadEnv(mode, process.cwd(), "");
Object.keys(env).forEach((key) => {
  if (typeof process.env[key] === "undefined") process.env[key] = env[key];
});

// Set default UPLOAD_BASE_URL for local development if not specified
if (!process.env.UPLOAD_BASE_URL) {
  process.env.UPLOAD_BASE_URL = mode === "development" ? "/uploads" : "https://trainercoachconnect.com/uploads";
}


function adminApiPlugin() {
  return {
    name: "admin-api",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.method !== "POST") return next();
        const url = req.url?.split('?')[0] || "";
        if (!url.startsWith("/__admin/")) return next();

          try {
            const adminTokenHeader = req.headers["x-admin-token"] as string | undefined;
            const expectedToken = process.env.ADMIN_TOKEN;
            const isListReq = url.startsWith("/__admin/list-users");

            if (!(isListReq && process.env.NODE_ENV !== "production")) {
              if (!expectedToken || adminTokenHeader !== expectedToken) {
                res.statusCode = 401;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
                return;
              }
            }

            // Example local DB connection or any custom backend API call
            const db = {
              query: async (q: string, params?: any[]) => {
                console.log("Mock DB query:", q, params);
                return [];
              },
            };

            let body = {};
            if (req.headers['content-length'] && req.headers['content-length'] !== '0') {
              const chunks: Buffer[] = [];
              for await (const chunk of req) {
                chunks.push(chunk as Buffer);
              }
              const raw = Buffer.concat(chunks).toString('utf8');
              if (raw) {
                body = JSON.parse(raw);
              }
            }

            // Example: handle M-Pesa credential storage (replace with your local DB)
            if (url.startsWith("/__admin/set-mpesa-credentials")) {
              try {
                const creds = body.credentials || null;
                if (!creds) throw new Error("Missing credentials in body");
                await db.query("UPSERT INTO platform_secrets (key, value) VALUES (?, ?)", [
                  "mpesa",
                  JSON.stringify(creds),
                ]);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true }));
              } catch (e: any) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: e.message }));
              }
              return;
            }

            if (url.startsWith("/__admin/get-mpesa-credentials")) {
              try {
                const rows = await db.query("SELECT value FROM platform_secrets WHERE key = ?", ["mpesa"]);
                const value = rows.length ? JSON.parse((rows as any)[0].value) : null;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, credentials: value }));
              } catch (e: any) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: e.message }));
              }
              return;
            }

            // Settings endpoints
            if (url.startsWith("/__admin/get-settings")) {
              try {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({
                  ok: true,
                  message: "Settings managed via localStorage on client. Use admin dashboard to configure M-Pesa."
                }));
              } catch (e: any) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: e.message }));
              }
              return;
            }

            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "Unknown endpoint" }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: err.message }));
          }
      });
    },
  };
}

// Example simplified payments plugin (M-Pesa only, no Supabase)
// Development API mock plugin
function devApiPlugin() {
  return {
    name: "dev-api",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.method !== "POST" && req.method !== "GET" && req.method !== "OPTIONS") return next();
        const url = req.url?.split('?')[0] || "";
        // Support both /api.php and api.php
        if (url !== "/api.php" && url !== "api.php" && !url.endsWith("/api.php")) return next();

        try {
          let body = {};

          // Handle request body parsing for POST
          if (req.method === "POST" && req.headers['content-length'] && req.headers['content-length'] !== '0') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(chunk as Buffer);
            }
            const raw = Buffer.concat(chunks).toString('utf8');
            if (raw) {
              try {
                body = JSON.parse(raw);
              } catch {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ status: "error", message: "Invalid JSON in request body." }));
                return;
              }
            }
          } else if (req.method === "GET") {
            body = req.url?.includes('?') ? Object.fromEntries(new URLSearchParams(req.url?.split('?')[1])) : {};
          }

          const action = (body.action || "").toLowerCase().trim();

          // Add CORS headers for broader compatibility
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Token");

          // Handle OPTIONS (pre-flight)
          if (req.method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
          }

          // Always set JSON content type first
          res.setHeader("Content-Type", "application/json; charset=utf-8");

          // Log the API call for debugging
          console.log(`[Dev API] ${req.method} ${action}`, { body });

          // Handle missing action
          if (!action) {
            res.statusCode = 400;
            res.end(JSON.stringify({ status: "error", message: "Missing action parameter.", data: null }));
            return;
          }

          // Mock responses for development
          switch (action) {
            case "health_check":
              res.end(JSON.stringify({
                status: "success",
                message: "Server is running",
                data: { timestamp: new Date().toISOString() }
              }));
              return;

            case "login":
              const email = body.email || "";
              if (!email || !body.password) {
                res.statusCode = 400;
                res.end(JSON.stringify({ status: "error", message: "Missing email or password." }));
                return;
              }

              // Determine user_type based on email pattern
              let loginUserType = "client"; // default
              if (email === "admin@skatryk.co.ke") {
                loginUserType = "admin";
              } else if (email.toLowerCase().includes("trainer")) {
                loginUserType = "trainer";
              }

              res.end(JSON.stringify({
                status: "success",
                message: "Login successful",
                data: {
                  user: {
                    id: "dev-user-" + email.substring(0, 3),
                    email: email
                  },
                  profile: {
                    user_type: loginUserType
                  },
                  session: {
                    access_token: "dev-token-" + Math.random().toString(36).substring(7)
                  }
                }
              }));
              return;

            case "signup":
              const signupEmail = body.email || "";
              const userType = body.user_type || "client";
              if (!signupEmail || !body.password) {
                res.statusCode = 400;
                res.end(JSON.stringify({ status: "error", message: "Missing required fields." }));
                return;
              }
              res.end(JSON.stringify({
                status: "success",
                message: "Signup successful",
                data: {
                  user: {
                    id: "dev-user-" + signupEmail.substring(0, 3),
                    email: signupEmail
                  },
                  profile: {
                    user_type: userType
                  },
                  session: {
                    access_token: "dev-token-" + Math.random().toString(36).substring(7)
                  }
                }
              }));
              return;

            case "get_users":
              // Proxy to real API to get users from database
              try {
                const authHeader = body.token ? { 'Authorization': `Bearer ${body.token}` } : {};
                const usersResponse = await fetch('https://trainercoachconnect.com/api.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({ action: 'get_users', user_type: body.user_type, status: body.status, search: body.search })
                });
                const usersData = await usersResponse.json();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(usersData));
              } catch (e) {
                console.error('Failed to fetch users:', e);
                res.end(JSON.stringify({
                  status: "success",
                  message: "Users retrieved",
                  data: []
                }));
              }
              return;

            case "get_categories":
              // Proxy to real API to get all categories from database
              try {
                const categoryResponse = await fetch('https://trainercoachconnect.com/api.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'get_categories' })
                });
                const categoryData = await categoryResponse.json();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(categoryData));
              } catch (e) {
                console.error('Failed to fetch categories from real API, using mock:', e);
                res.end(JSON.stringify({
                  status: "success",
                  message: "Categories retrieved",
                  data: [
                    { id: 1, name: "Strength Training", icon: "💪", description: "Build muscle and increase strength" },
                    { id: 2, name: "Cardio", icon: "🏃", description: "Improve cardiovascular fitness" },
                    { id: 3, name: "Yoga", icon: "🧘", description: "Flexibility and mindfulness" },
                    { id: 4, name: "HIIT", icon: "⚡", description: "High-intensity interval training" }
                  ]
                }));
              }
              return;

            case "notifications_get":
              res.end(JSON.stringify({
                status: "success",
                message: "Notifications retrieved",
                data: []
              }));
              return;

            case "trainer_categories_get":
              // Proxy to real API to get trainer's categories from database
              try {
                const authHeader = body.token ? { 'Authorization': `Bearer ${body.token}` } : {};
                const catResponse = await fetch('https://trainercoachconnect.com/api.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({ action: 'trainer_categories_get', trainer_id: body.trainer_id })
                });
                const catData = await catResponse.json();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(catData));
              } catch (e) {
                console.error('Failed to fetch trainer categories:', e);
                res.end(JSON.stringify({
                  status: "success",
                  message: "Trainer categories retrieved",
                  data: []
                }));
              }
              return;

            case "get_trainers":
            case "get_trainer_details":
              // Proxy to real API to get trainers from database
              try {
                const authHeader = body.token ? { 'Authorization': `Bearer ${body.token}` } : {};
                const trainersResponse = await fetch('https://trainercoachconnect.com/api.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({ action: action, trainer_id: body.trainer_id, status: body.status, search: body.search })
                });
                const trainersData = await trainersResponse.json();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(trainersData));
              } catch (e) {
                console.error('Failed to fetch trainers:', e);
                res.end(JSON.stringify({
                  status: "success",
                  message: "Trainers retrieved",
                  data: []
                }));
              }
              return;

            case "create_booking":
              res.end(JSON.stringify({
                status: "success",
                message: "Booking created successfully",
                data: { booking_id: "booking_" + Math.random().toString(36).substring(7) }
              }));
              return;

            case "get_bookings":
              // Proxy to real API to get bookings from database
              try {
                const authHeader = body.token ? { 'Authorization': `Bearer ${body.token}` } : {};
                const bookingsResponse = await fetch('https://trainercoachconnect.com/api.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({ action: 'get_bookings', status: body.status, trainer_id: body.trainer_id, client_id: body.client_id })
                });
                const bookingsData = await bookingsResponse.json();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(bookingsData));
              } catch (e) {
                console.error('Failed to fetch bookings:', e);
                res.end(JSON.stringify({
                  status: "success",
                  message: "Bookings retrieved",
                  data: []
                }));
              }
              return;

            case "profile_get":
              res.end(JSON.stringify({
                status: "success",
                message: "Profile retrieved",
                data: { id: "profile_" + Math.random().toString(36).substring(7) }
              }));
              return;

            case "trainer_group_pricing_get":
              res.end(JSON.stringify({
                status: "success",
                message: "Pricing retrieved",
                data: []
              }));
              return;

            case "trainer_group_pricing_delete":
              res.end(JSON.stringify({
                status: "success",
                message: "Pricing deleted",
                data: null
              }));
              return;

            case "payout_requests_get":
              // Proxy to real API to get payout requests from database
              try {
                const authHeader = body.token ? { 'Authorization': `Bearer ${body.token}` } : {};
                const payoutResponse = await fetch('https://trainercoachconnect.com/api.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({ action: 'payout_requests_get', status: body.status, trainer_id: body.trainer_id })
                });
                const payoutData = await payoutResponse.json();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(payoutData));
              } catch (e) {
                console.error('Failed to fetch payout requests:', e);
                res.end(JSON.stringify({
                  status: "success",
                  message: "Payout requests retrieved",
                  data: []
                }));
              }
              return;

            case "b2c_payments_get":
              // Proxy to real API to get B2C payments from database
              try {
                const authHeader = body.token ? { 'Authorization': `Bearer ${body.token}` } : {};
                const b2cResponse = await fetch('https://trainercoachconnect.com/api.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({ action: 'b2c_payments_get', status: body.status })
                });
                const b2cData = await b2cResponse.json();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(b2cData));
              } catch (e) {
                console.error('Failed to fetch B2C payments:', e);
                res.end(JSON.stringify({
                  status: "success",
                  message: "B2C payments retrieved",
                  data: []
                }));
              }
              return;

            case "announcement_create":
              res.end(JSON.stringify({
                status: "success",
                message: "Announcement created",
                data: { id: "announcement_" + Math.random().toString(36).substring(7) }
              }));
              return;

            case "promotion_requests_get":
              // Proxy to real API to get promotion requests from database
              try {
                const authHeader = body.token ? { 'Authorization': `Bearer ${body.token}` } : {};
                const promoResponse = await fetch('https://trainercoachconnect.com/api.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({ action: 'promotion_requests_get', status: body.status })
                });
                const promoData = await promoResponse.json();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(promoData));
              } catch (e) {
                console.error('Failed to fetch promotion requests:', e);
                res.end(JSON.stringify({
                  status: "success",
                  message: "Promotion requests retrieved",
                  data: []
                }));
              }
              return;

            case "promotion_request_approve":
              // Proxy to real API to approve promotion requests
              try {
                const authHeader = body.token ? { 'Authorization': `Bearer ${body.token}` } : {};
                const approveResponse = await fetch('https://trainercoachconnect.com/api.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({ action: 'promotion_request_approve', request_id: body.request_id })
                });
                const approveData = await approveResponse.json();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(approveData));
              } catch (e) {
                console.error('Failed to approve promotion request:', e);
                res.statusCode = 500;
                res.end(JSON.stringify({
                  status: "error",
                  message: "Failed to approve promotion request"
                }));
              }
              return;

            case "promotion_request_reject":
              // Proxy to real API to reject promotion requests
              try {
                const authHeader = body.token ? { 'Authorization': `Bearer ${body.token}` } : {};
                const rejectResponse = await fetch('https://trainercoachconnect.com/api.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({ action: 'promotion_request_reject', request_id: body.request_id })
                });
                const rejectData = await rejectResponse.json();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(rejectData));
              } catch (e) {
                console.error('Failed to reject promotion request:', e);
                res.statusCode = 500;
                res.end(JSON.stringify({
                  status: "error",
                  message: "Failed to reject promotion request"
                }));
              }
              return;

            case "payments_get":
              // Proxy to real API to get payments from database
              try {
                const authHeader = body.token ? { 'Authorization': `Bearer ${body.token}` } : {};
                const paymentsResponse = await fetch('https://trainercoachconnect.com/api.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({ action: 'payments_get', status: body.status, trainer_id: body.trainer_id, client_id: body.client_id })
                });
                const paymentsData = await paymentsResponse.json();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(paymentsData));
              } catch (e) {
                console.error('Failed to fetch payments:', e);
                res.end(JSON.stringify({
                  status: "success",
                  message: "Payments retrieved",
                  data: []
                }));
              }
              return;

            case "payout_insert":
              res.end(JSON.stringify({
                status: "success",
                message: "Payout request created",
                data: { id: "payout_" + Math.random().toString(36).substring(7) }
              }));
              return;

            case "verification_documents_get":
              // Proxy to real API to get trainer's documents from database
              try {
                const authHeader = body.token ? { 'Authorization': `Bearer ${body.token}` } : {};
                const docGetResponse = await fetch('https://trainercoachconnect.com/api.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader },
                  body: JSON.stringify({ action: 'verification_documents_get', trainer_id: body.trainer_id })
                });
                const docGetData = await docGetResponse.json();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(docGetData));
              } catch (e) {
                console.error('Failed to fetch verification documents, using empty response:', e);
                res.end(JSON.stringify({
                  status: "success",
                  message: "Verification documents retrieved",
                  data: []
                }));
              }
              return;

            case "verification_documents_list":
              // Proxy to real API to get all pending documents for admin review
              try {
                const authHeader = body.token ? { 'Authorization': `Bearer ${body.token}` } : {};
                const adminTokenHeader = body.admin_token ? { 'X-Admin-Token': body.admin_token } : {};
                const docListResponse = await fetch('https://trainercoachconnect.com/api.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...authHeader, ...adminTokenHeader },
                  body: JSON.stringify({ action: 'verification_documents_list', status: body.status })
                });
                const docListData = await docListResponse.json();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(docListData));
              } catch (e) {
                console.error('Failed to list verification documents, using empty response:', e);
                res.end(JSON.stringify({
                  status: "success",
                  message: "Verification documents listed",
                  data: []
                }));
              }
              return;

            case "verification_document_upload":
              res.end(JSON.stringify({
                status: "success",
                message: "Document uploaded successfully",
                data: { file_url: "/uploads/doc_" + Math.random().toString(36).substring(7) }
              }));
              return;

            case "verification_document_verify":
              // Proxy to real API to approve/reject documents
              try {
                const adminTokenHeader = body.admin_token ? { 'X-Admin-Token': body.admin_token } : req.headers['x-admin-token'] ? { 'X-Admin-Token': req.headers['x-admin-token'] } : {};
                const verifyResponse = await fetch('https://trainercoachconnect.com/api.php', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...adminTokenHeader },
                  body: JSON.stringify({ action: 'verification_document_verify', document_id: body.document_id, status: body.status, rejection_reason: body.rejection_reason })
                });
                const verifyData = await verifyResponse.json();
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify(verifyData));
              } catch (e) {
                console.error('Failed to verify document:', e);
                res.statusCode = 500;
                res.end(JSON.stringify({
                  status: "error",
                  message: "Failed to verify document"
                }));
              }
              return;

            case "check_documents_submission":
              res.end(JSON.stringify({
                status: "success",
                message: "Documents submission checked",
                data: { all_submitted: false }
              }));
              return;

            case "message_insert":
              res.end(JSON.stringify({
                status: "success",
                message: "Message sent",
                data: { id: "message_" + Math.random().toString(36).substring(7) }
              }));
              return;

            case "request_password_reset":
              res.end(JSON.stringify({
                status: "success",
                message: "Password reset email sent",
                data: null
              }));
              return;

            case "reset_password_with_token":
              res.end(JSON.stringify({
                status: "success",
                message: "Password reset successfully",
                data: null
              }));
              return;

            case "waitlist_migration":
              res.end(JSON.stringify({
                status: "success",
                message: "Waitlist table created",
                data: null
              }));
              return;

            case "waitlist_alter_table":
              res.end(JSON.stringify({
                status: "success",
                message: "Waitlist table altered",
                data: null
              }));
              return;

            case "seed_categories":
              res.end(JSON.stringify({
                status: "success",
                message: "Categories seeded",
                data: null
              }));
              return;

            case "migrate":
              res.end(JSON.stringify({
                status: "success",
                message: "Migration completed"
              }));
              return;

            case "seed_all_users":
              res.end(JSON.stringify({
                status: "success",
                message: "Users seeded successfully",
                data: []
              }));
              return;

            case "select":
            case "insert":
            case "update":
            case "delete":
              res.end(JSON.stringify({
                status: "success",
                message: "Database operation completed",
                data: []
              }));
              return;

            // M-Pesa STK Push Initiation (mock for development)
            case "mpesa_stk_initiate":
              if (!body.phone || !body.amount) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify({
                  status: "error",
                  message: "Missing phone or amount"
                }));
                return;
              }
              // Mock successful STK push initiation
              const mockCheckoutId = "WEB" + Date.now() + Math.random().toString(36).substring(7);
              const mockMerchantId = "MER" + Math.random().toString(36).substring(7);
              const mockResponse = {
                status: "success",
                message: "STK push initiated successfully",
                data: {
                  checkout_request_id: mockCheckoutId,
                  merchant_request_id: mockMerchantId,
                  response_code: "0",
                  response_description: "The service request has been accepted successfully."
                }
              };
              console.log(`[Dev API] Mock STK push initiated for ${body.phone} with amount ${body.amount}`, mockResponse);
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify(mockResponse));
              return;

            // M-Pesa STK Push Query (mock for development)
            case "mpesa_stk_query":
              if (!body.checkout_request_id) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify({
                  status: "error",
                  message: "Missing checkout_request_id"
                }));
                return;
              }
              // Mock successful payment (return code 0 = success)
              const queryResponse = {
                status: "success",
                message: "STK push status queried successfully",
                data: {
                  result_code: "0",
                  result_description: "The service request has been accepted successfully.",
                  merchant_request_id: "MER" + Math.random().toString(36).substring(7),
                  checkout_request_id: body.checkout_request_id
                }
              };
              console.log(`[Dev API] Mock STK query for checkout ID ${body.checkout_request_id}`, queryResponse);
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify(queryResponse));
              return;

            // Default: return success for any unknown action
            default:
              console.warn(`[Dev API] Unknown action: ${action}`);
              res.end(JSON.stringify({
                status: "success",
                message: `Action '${action}' processed (mocked in development)`,
                data: []
              }));
              return;
          }
        } catch (e: any) {
          console.error("Dev API error:", e);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ status: "error", message: "Internal server error: " + e.message }));
        }
      });
    },
  };
}

function paymentsApiPlugin() {
  return {
    name: "payments-api",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.method !== "POST") return next();
        const url = req.url?.split('?')[0] || "";
        if (!url.startsWith("/payments/mpesa/")) return next();

        try {
          let body = {};
          if (req.headers['content-length'] && req.headers['content-length'] !== '0') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(chunk as Buffer);
            }
            const raw = Buffer.concat(chunks).toString('utf8');
            if (raw) {
              body = JSON.parse(raw);
            }
          }

          // Get M-Pesa credentials from request body (passed by frontend) or environment variables
          const clientCreds = body.mpesa_creds || {};

          const creds = {
            consumer_key: clientCreds.consumerKey || process.env.MPESA_CONSUMER_KEY,
            consumer_secret: clientCreds.consumerSecret || process.env.MPESA_CONSUMER_SECRET,
            shortcode: clientCreds.shortcode || process.env.MPESA_SHORTCODE,
            passkey: clientCreds.passkey || process.env.MPESA_PASSKEY,
            environment: clientCreds.environment || process.env.MPESA_ENVIRONMENT || "sandbox",
            result_url: clientCreds.resultUrl || process.env.MPESA_RESULT_URL,
          };

          // Validate that credentials are present
          if (!creds.consumer_key || !creds.consumer_secret) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "M-Pesa credentials not configured. Please check admin settings." }));
            return;
          }

          const envMode = creds.environment;
          const tokenUrl =
            envMode === "production"
              ? "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
              : "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

          const basic = Buffer.from(
            `${creds.consumer_key}:${creds.consumer_secret}`
          ).toString("base64");

          const tokenRes = await fetch(tokenUrl, {
            headers: { Authorization: `Basic ${basic}` },
          });
          const tokenJson = await tokenRes.json() as any;
          const accessToken = tokenJson?.access_token;
          if (!accessToken) throw new Error("Failed to obtain access token");

          if (url.startsWith("/payments/mpesa/stk-initiate")) {
            const phone = String(body.phone || "").trim();
            const amount = Math.round(Number(body.amount || 0));
            const shortcode = creds.shortcode!;
            const passkey = creds.passkey!;
            const callback = creds.result_url || "https://example.com/mpesa/callback";
            const timestamp = new Date()
              .toISOString()
              .replace(/[-:.TZ]/g, "")
              .slice(0, 14);
            const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

            const stkUrl =
              envMode === "production"
                ? "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
                : "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

            const payload = {
              BusinessShortCode: shortcode,
              Password: password,
              Timestamp: timestamp,
              TransactionType: "CustomerPayBillOnline",
              Amount: amount,
              PartyA: phone,
              PartyB: shortcode,
              PhoneNumber: phone,
              CallBackURL: callback,
              AccountReference: "OrderRef",
              TransactionDesc: "Payment",
            };

            const stkRes = await fetch(stkUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            });

            const stkJson = await stkRes.json();
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, result: stkJson }));
            return;
          }

          if (url.startsWith("/payments/mpesa/stk-query")) {
            const checkoutRequestId = String(body.checkout_request_id || "").trim();
            if (!checkoutRequestId) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Missing checkout_request_id" }));
              return;
            }

            try {
              const queryUrl =
                envMode === "production"
                  ? "https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query"
                  : "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query";

              const timestamp = new Date()
                .toISOString()
                .replace(/[-:.TZ]/g, "")
                .slice(0, 14);
              const password = Buffer.from(`${creds.shortcode}${creds.passkey}${timestamp}`).toString("base64");

              const queryRes = await fetch(queryUrl, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  BusinessShortCode: creds.shortcode,
                  Password: password,
                  Timestamp: timestamp,
                  CheckoutRequestID: checkoutRequestId,
                }),
              });

              const queryJson = await queryRes.json();
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, result: queryJson }));
              return;
            } catch (e: any) {
              console.error("STK Query error:", e);
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: e.message }));
              return;
            }
          }

          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: "Unknown payments route" }));
        } catch (e: any) {
          console.error("Payments API error:", e);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
    },
  };
}

// Export final Vite config
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api.php': {
        target: 'https://trainercoachconnect.com',
        changeOrigin: true,
        rewrite: (path) => path,
        secure: true,
      }
    }
  },
  plugins: [
    react(),
    // Using remote API for all environments - dev API plugin disabled
    // mode === 'development' && devApiPlugin(),  // Disabled - using remote API instead
    mode === 'development' && adminApiPlugin(),
    mode === 'development' && paymentsApiPlugin(),
    mode === 'development' && componentTagger(),
    {
      name: "copy-php-files",
      closeBundle() {
        // Ensure dist directory exists before copying
        const distDir = path.resolve(__dirname, "dist");
        if (fs.existsSync(distDir)) {
          // Copy root PHP files
          const rootFiles = fs.readdirSync(__dirname).filter(f => f.endsWith(".php"));
          rootFiles.forEach(f => {
            const src = path.resolve(__dirname, f);
            const dest = path.resolve(distDir, f);
            fs.cpSync(src, dest);
            console.log(`[copy-php-files] Copied root file: ${f} to dist/`);
          });

          // Copy specific folders that are part of the backend
          const backendFolders = ["scripts", "database"];
          backendFolders.forEach(folder => {
            const folderPath = path.resolve(__dirname, folder);
            if (fs.existsSync(folderPath)) {
              const destPath = path.resolve(distDir, folder);
              fs.cpSync(folderPath, destPath, { recursive: true });
              console.log(`[copy-php-files] Copied ${folder}/ folder to dist/`);
            }
          });

          // Ensure uploads folder exists in dist
          const uploadsDir = path.resolve(distDir, "uploads");
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log(`[copy-php-files] Created uploads directory: ${uploadsDir}`);
          }
          // Set permissions to make it writable
          try {
            fs.chmodSync(uploadsDir, 0o755);
            console.log(`[copy-php-files] Set permissions for uploads directory`);
          } catch (e) {
            console.warn(`[copy-php-files] Could not set permissions for uploads directory`, e);
          }
        }
      }
    }
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': [
            'react',
            'react-dom',
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ]
        },
      },
    },
  },
}));
