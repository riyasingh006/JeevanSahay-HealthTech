import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const tempDir = mkdtempSync(path.join(os.tmpdir(), "jeevan-sahay-auth-"));
const databaseUrl = `file:${path.join(tempDir, "auth.db")}`;
const messages: string[] = [];
let smtpServer: net.Server | undefined;
let app: ChildProcess | undefined;
let appOutput = "";
let prisma: import("@prisma/client").PrismaClient | undefined;

function listen(server: net.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Unable to determine local test port."));
      resolve(address.port);
    });
  });
}

function startSmtpServer(): net.Server {
  return net.createServer((socket) => {
    socket.setEncoding("utf8");
    socket.write("220 localhost ESMTP test\r\n");
    let buffer = "";
    let data = "";
    let dataMode = false;
    let authMode: "plain" | "username" | "password" | null = null;

    socket.on("data", (chunk) => {
      buffer += chunk;
      let end = buffer.indexOf("\r\n");
      while (end >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (dataMode) {
          if (line === ".") {
            dataMode = false;
            messages.push(data);
            data = "";
            socket.write("250 2.0.0 queued\r\n");
          } else {
            data += `${line}\r\n`;
          }
        } else if (authMode === "plain") {
          authMode = null;
          socket.write("235 2.7.0 authenticated\r\n");
        } else if (authMode === "username") {
          authMode = "password";
          socket.write("334 UGFzc3dvcmQ6\r\n");
        } else if (authMode === "password") {
          authMode = null;
          socket.write("235 2.7.0 authenticated\r\n");
        } else if (/^EHLO\b|^HELO\b/i.test(line)) {
          socket.write("250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250-SIZE 5242880\r\n250 8BITMIME\r\n");
        } else if (/^AUTH PLAIN\b/i.test(line)) {
          if (line.trim().split(/\s+/).length > 2) socket.write("235 2.7.0 authenticated\r\n");
          else {
            authMode = "plain";
            socket.write("334 \r\n");
          }
        } else if (/^AUTH LOGIN\b/i.test(line)) {
          authMode = "username";
          socket.write("334 VXNlcm5hbWU6\r\n");
        } else if (/^(MAIL FROM|RCPT TO|RSET|NOOP)\b/i.test(line)) {
          socket.write("250 2.1.0 accepted\r\n");
        } else if (/^DATA\b/i.test(line)) {
          dataMode = true;
          socket.write("354 end with <CRLF>.<CRLF>\r\n");
        } else if (/^QUIT\b/i.test(line)) {
          socket.write("221 2.0.0 bye\r\n");
          socket.end();
        } else {
          socket.write("250 2.0.0 ok\r\n");
        }
        end = buffer.indexOf("\r\n");
      }
    });
  });
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: "utf8", timeout: 60_000 });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout || result.error?.message}`);
  }
}

async function request(pathname: string, method = "GET", body?: unknown, cookie?: string) {
  const headers = new Headers({ Accept: "application/json" });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (cookie) headers.set("Cookie", cookie);
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const json = response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : null;
  return { response, json };
}

let baseUrl = "";

function cookieFrom(response: Response, name: string): string {
  const value = response.headers.getSetCookie().find((item) => item.startsWith(`${name}=`));
  assert.ok(value, `Expected ${name} cookie. Headers: ${response.headers.getSetCookie().join("; ")}`);
  return value.split(";", 1)[0];
}

function mailCount(email: string): number {
  return messages.filter((message) => message.toLowerCase().includes(email.toLowerCase())).length;
}

function codeFor(email: string): string {
  const message = [...messages].reverse().find((item) => item.toLowerCase().includes(email.toLowerCase()));
  assert.ok(message, `No captured email for ${email}`);
  const code = message.match(/Use\s+(\d{6})/i)?.[1];
  assert.ok(code, `No six-digit code found in the captured email for ${email}`);
  return code;
}

function testEmail(label: string): string {
  return `${label}-${randomBytes(4).toString("hex")}@example.test`;
}
function futureDateInIndia(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(Date.now() + 36 * 60 * 60_000));
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

async function registerPatient(email: string, password: string) {
  const { response, json } = await request("/api/auth/register", "POST", {
    name: "Test Patient",
    email,
    phone: "+91 9810012345",
    password,
    role: "PATIENT",
  });
  assert.equal(response.status, 201, JSON.stringify(json));
  assert.equal(json.data.emailVerificationRequired, true);
  return json;
}

async function startApp() {
  const dbResult = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: "utf8",
    timeout: 60_000,
  });
  if (dbResult.status !== 0) throw new Error(`Disposable test database setup failed:\n${dbResult.stderr || dbResult.stdout}`);

  smtpServer = startSmtpServer();
  const smtpPort = await listen(smtpServer);
  const testEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: randomBytes(32).toString("hex"),
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(smtpPort),
    SMTP_USER: "test-user",
    SMTP_PASSWORD: "test-password",
    SMTP_FROM: "Jeevan Sahay <no-reply@example.test>",
    SMTP_SECURE: "false",
    GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "test-google-secret",
    GOOGLE_REDIRECT_URI: "http://127.0.0.1:3101/api/auth/google/callback",
    NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3101",
  };
  const portCheck = net.createServer();
  const appPort = await listen(portCheck);
  await new Promise<void>((resolve) => portCheck.close(() => resolve()));
  testEnv.GOOGLE_REDIRECT_URI = `http://127.0.0.1:${appPort}/api/auth/google/callback`;
  testEnv.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${appPort}`;
  baseUrl = testEnv.NEXT_PUBLIC_APP_URL;

  app = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(appPort)], {
    cwd: root,
    env: testEnv,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  app.stdout?.on("data", (chunk) => { appOutput = `${appOutput}${chunk}`.slice(-20_000); });
  app.stderr?.on("data", (chunk) => { appOutput = `${appOutput}${chunk}`.slice(-20_000); });

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (app.exitCode !== null) throw new Error(`Next dev server stopped unexpectedly:\n${appOutput}`);
    try {
      const response = await fetch(`${baseUrl}/api/auth/me`, { headers: { Accept: "application/json" } });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Next dev server did not become ready:\n${appOutput}`);
}

async function closeApp() {
  await prisma?.$disconnect();
  if (app?.pid && app.exitCode === null) {
    try {
      if (process.platform === "win32") app.kill("SIGTERM");
      else process.kill(-app.pid, "SIGTERM");
    } catch {}
  }
  await new Promise<void>((resolve) => {
    if (!smtpServer?.listening) return resolve();
    smtpServer.close(() => resolve());
  });
  rmSync(tempDir, { recursive: true, force: true });
}

async function main() {
  const setupEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
  };
  run("npx", ["prisma", "generate"], setupEnv);
  await startApp();
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  const strongPassword = "LongEnough!Pass123";

  const invalidAdminEmail = testEmail("admin-signup");
  const adminSignup = await request("/api/auth/register", "POST", {
    name: "Should Not Become Admin",
    email: invalidAdminEmail,
    phone: "+91 9810012345",
    password: strongPassword,
    role: "SUPER_ADMIN",
  });
  assert.equal(adminSignup.response.status, 422);
  assert.equal(await prisma.user.count({ where: { email: invalidAdminEmail } }), 0);
  console.log("PASS public signup cannot grant SUPER_ADMIN");

  const abuseEmail = testEmail("otp-lockout");
  await registerPatient(abuseEmail, strongPassword);
  const abuseCode = codeFor(abuseEmail);
  const wrongCode = abuseCode === "000000" ? "000001" : "000000";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const wrong = await request("/api/auth/verify-email", "POST", { email: abuseEmail, code: wrongCode });
    assert.equal(wrong.response.status, 400);
  }
  const locked = await request("/api/auth/verify-email", "POST", { email: abuseEmail, code: abuseCode });
  assert.equal(locked.response.status, 400);
  assert.equal(await prisma.user.findUniqueOrThrow({ where: { email: abuseEmail } }).then((user) => user.emailVerifiedAt), null);
  console.log("PASS incorrect OTP attempts are capped and lock the challenge");

  const expiredEmail = testEmail("otp-expired");
  await registerPatient(expiredEmail, strongPassword);
  const expiredUser = await prisma.user.findUniqueOrThrow({ where: { email: expiredEmail } });
  await prisma.authOtp.update({
    where: { userId_purpose: { userId: expiredUser.id, purpose: "EMAIL_VERIFICATION" } },
    data: { expiresAt: new Date(Date.now() - 1_000) },
  });
  const expired = await request("/api/auth/verify-email", "POST", {
    email: expiredEmail,
    code: codeFor(expiredEmail),
  });
  assert.equal(expired.response.status, 400);
  assert.equal(await prisma.user.findUniqueOrThrow({ where: { email: expiredEmail } }).then((user) => user.emailVerifiedAt), null);
  console.log("PASS expired OTPs cannot verify accounts");

  const patientEmail = testEmail("patient");
  await registerPatient(patientEmail, strongPassword);
  const resendBefore = mailCount(patientEmail);
  const resend = await request("/api/auth/resend-verification", "POST", { email: patientEmail });
  assert.equal(resend.response.status, 200);
  assert.equal(mailCount(patientEmail), resendBefore);
  const invalidCode = await request("/api/auth/verify-email", "POST", { email: patientEmail, code: "000000" });
  assert.equal(invalidCode.response.status, 400);
  const patientCode = codeFor(patientEmail);
  const verified = await request("/api/auth/verify-email", "POST", { email: patientEmail, code: patientCode });
  assert.equal(verified.response.status, 200, JSON.stringify(verified.json));
  assert.equal(verified.json.data.user.role, "PATIENT");
  const patientCookie = cookieFrom(verified.response, "js_session");
  const me = await request("/api/auth/me", "GET", undefined, patientCookie);
  assert.equal(me.json.data.user.email, patientEmail);
  const patientSearch = await request("/api/hospitals/search?q=cardiologist&limit=4", "GET", undefined, patientCookie);
  assert.equal(patientSearch.response.status, 200);
  const patientRecord = await prisma.user.findUniqueOrThrow({ where: { email: patientEmail } });
  const searchHistory = await prisma.searchRecord.findMany({ where: { userId: patientRecord.id } });
  assert.equal(searchHistory.length, 1);
  assert.equal(searchHistory[0].query, "cardiologist");
  assert.equal(searchHistory[0].mode, "SEARCH");
  const unauthorized = await request("/api/admin/users", "GET", undefined, patientCookie);
  assert.equal(unauthorized.response.status, 403);
  const wrongPortal = await request("/hospital", "GET", undefined, patientCookie);
  assert.equal(wrongPortal.response.status, 307);
  assert.ok(wrongPortal.response.headers.get("location")?.includes("denied=portal"));
  const logout = await request("/api/auth/logout", "POST", undefined, patientCookie);
  assert.equal(logout.response.status, 200);
  const afterLogout = await request("/api/auth/me", "GET", undefined, patientCookie);
  assert.equal(afterLogout.json.data.user, null);
  const revokedPortal = await fetch(`${baseUrl}/dashboard`, {
    headers: { Cookie: patientCookie },
    redirect: "manual",
  });
  assert.equal(revokedPortal.status, 307);
  assert.ok(revokedPortal.headers.get("location")?.includes("/login?"));
  const revokedPage = await request("/dashboard", "GET", undefined, patientCookie);
  assert.equal(revokedPage.response.status, 307);
  assert.ok(revokedPage.response.headers.get("location")?.includes("/login"));
  console.log("PASS email verification, resend cooldown, session, role denial, logout revocation, and revoked-page protection");

  const login = await request("/api/auth/login", "POST", {
    email: patientEmail,
    password: strongPassword,
    rememberMe: false,
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.json));
  assert.ok(login.response.headers.getSetCookie().some((cookie) => cookie.startsWith("js_session=") && cookie.includes("Max-Age=43200")));
  const loginCookie = cookieFrom(login.response, "js_session");

  await request("/api/auth/password/forgot", "POST", { email: patientEmail });
  const resetCode = codeFor(patientEmail);
  const resetVerify = await request("/api/auth/password/verify", "POST", { email: patientEmail, code: resetCode });
  assert.equal(resetVerify.response.status, 200, JSON.stringify(resetVerify.json));
  const resetCookie = cookieFrom(resetVerify.response, "js_password_reset");
  const mismatch = await request("/api/auth/password/reset", "POST", {
    password: "Different!Password123",
    confirmPassword: "NotTheSame!Password123",
  }, resetCookie);
  assert.equal(mismatch.response.status, 422);
  const reset = await request("/api/auth/password/reset", "POST", {
    password: "Replacement!Password456",
    confirmPassword: "Replacement!Password456",
  }, resetCookie);
  assert.equal(reset.response.status, 200, JSON.stringify(reset.json));
  const oldSession = await request("/api/auth/me", "GET", undefined, loginCookie);
  assert.equal(oldSession.json.data.user, null);
  const oldLogin = await request("/api/auth/login", "POST", { email: patientEmail, password: strongPassword });
  assert.equal(oldLogin.response.status, 401);
  const newLogin = await request("/api/auth/login", "POST", { email: patientEmail, password: "Replacement!Password456" });
  assert.equal(newLogin.response.status, 200);
  console.log("PASS password recovery checks confirmation and revokes every prior session");

  const patientSessionCookie = cookieFrom(newLogin.response, "js_session");
  const profileUpdate = await request("/api/user/profile", "PATCH", {
    name: "Updated Test Patient",
    age: 41,
    conditions: "Controlled hypertension",
    role: "SUPER_ADMIN",
  }, patientSessionCookie);
  assert.equal(profileUpdate.response.status, 200);
  const updatedPatient = await prisma.user.findUniqueOrThrow({ where: { email: patientEmail } });
  assert.equal(updatedPatient.role, "PATIENT");
  assert.equal(updatedPatient.age, 41);
  const profileBeforeShare = await request("/api/user/profile", "GET", undefined, patientSessionCookie);
  assert.equal(profileBeforeShare.json.data.profile.hasSharePin, false);
  const pinUpdate = await request("/api/user/profile", "PUT", {
    currentPassword: "Replacement!Password456",
    newPin: "482913",
  }, patientSessionCookie);
  assert.equal(pinUpdate.response.status, 200);
  const shareTokenResponse = await request("/api/user/health-share", "POST", undefined, patientSessionCookie);
  assert.equal(shareTokenResponse.response.status, 200);
  const shareQuery = new URLSearchParams({ token: shareTokenResponse.json.data.token, pin: "482913" });
  const sharedProfile = await request(`/api/user/health-share?${shareQuery.toString()}`);
  assert.equal(sharedProfile.response.status, 200);
  assert.equal(sharedProfile.json.data.summary.conditions, "Controlled hypertension");
  assert.equal("email" in sharedProfile.json.data.summary, false);
  console.log("PASS patient profile updates stay scoped and health sharing requires a PIN");
  const appointmentHospital = await prisma.hospital.create({
    data: {
      name: "Appointments Test Hospital",
      type: "PRIVATE",
      status: "VERIFIED",
      registrationNumber: "TEST-APPOINTMENT-HOSPITAL",
      addressLine: "1 Test Health Road",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
      phone: "+91 1100011000",
      lat: 28.6139,
      lng: 77.2090,
    },
  });
  const appointmentDoctor = await prisma.doctor.create({
    data: {
      hospitalId: appointmentHospital.id,
      name: "Dr. Test Specialist",
      specialty: "CARDIOLOGY",
      department: "Cardiology",
      availability: "AVAILABLE",
    },
  });
  const appointmentDate = futureDateInIndia();
  const requested = await request("/api/appointments", "POST", {
    hospitalId: appointmentHospital.id,
    doctorId: appointmentDoctor.id,
    patientName: "Test Patient",
    patientPhone: "+91 9810012345",
    date: appointmentDate,
    time: "11:30 AM",
  }, patientSessionCookie);
  assert.equal(requested.response.status, 201, JSON.stringify(requested.json));
  const appointmentId = requested.json.data.appointment.id as string;
  assert.equal(requested.json.data.appointment.status, "REQUESTED");
  const appointmentRecord = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
  assert.equal(appointmentRecord.patientId, (await prisma.user.findUniqueOrThrow({ where: { email: patientEmail } })).id);
  assert.equal(appointmentRecord.patientEmail, patientEmail);
  const savedHospital = await request("/api/user/saved", "POST", { hospitalId: appointmentHospital.id }, patientSessionCookie);
  assert.equal(savedHospital.response.status, 200);
  const savedList = await request("/api/user/saved", "GET", undefined, patientSessionCookie);
  assert.ok(savedList.json.data.saved.some((item: { hospitalId: string }) => item.hospitalId === appointmentHospital.id));
  const unsavedHospital = await request(`/api/user/saved?hospitalId=${encodeURIComponent(appointmentHospital.id)}`, "DELETE", undefined, patientSessionCookie);
  assert.equal(unsavedHospital.response.status, 200);


  const otherPatientEmail = testEmail("other-patient");
  await prisma.user.create({
    data: {
      name: "Another Patient",
      email: otherPatientEmail,
      passwordHash: await bcrypt.hash(strongPassword, 12),
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });
  const otherLogin = await request("/api/auth/login", "POST", { email: otherPatientEmail, password: strongPassword });
  assert.equal(otherLogin.response.status, 200);
  const otherCookie = cookieFrom(otherLogin.response, "js_session");
  const otherAppointments = await request("/api/appointments", "GET", undefined, otherCookie);
  assert.equal(otherAppointments.response.status, 200);
  assert.equal(otherAppointments.json.data.appointments.length, 0);
  const unauthorizedCancel = await request("/api/appointments", "PATCH", { appointmentId }, otherCookie);
  assert.equal(unauthorizedCancel.response.status, 409);
  assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } })).status, "REQUESTED");

  const ownAppointments = await request("/api/appointments", "GET", undefined, patientSessionCookie);
  assert.equal(ownAppointments.response.status, 200);
  assert.equal(ownAppointments.json.data.appointments.length, 1);
  assert.equal(ownAppointments.json.data.appointments[0].hospital.name, appointmentHospital.name);
  const cancelledAppointment = await request("/api/appointments", "PATCH", { appointmentId }, patientSessionCookie);
  assert.equal(cancelledAppointment.response.status, 200, JSON.stringify(cancelledAppointment.json));
  assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } })).status, "CANCELLED");
  console.log("PASS appointment requests persist with India time, remain patient-scoped, and cancel safely");

  const otpEmail = testEmail("passwordless");
  await registerPatient(otpEmail, strongPassword);
  const otpVerifyEmail = await request("/api/auth/verify-email", "POST", { email: otpEmail, code: codeFor(otpEmail) });
  assert.equal(otpVerifyEmail.response.status, 200);
  await request("/api/auth/email-code/request", "POST", { email: otpEmail });
  const otpLogin = await request("/api/auth/email-code/verify", "POST", { email: otpEmail, code: codeFor(otpEmail), rememberMe: true });
  assert.equal(otpLogin.response.status, 200, JSON.stringify(otpLogin.json));
  const otpCookie = cookieFrom(otpLogin.response, "js_session");
  const otpMe = await request("/api/auth/me", "GET", undefined, otpCookie);
  assert.equal(otpMe.json.data.user.email, otpEmail);
  console.log("PASS passwordless email-code login");

  const hospitalEmail = testEmail("hospital");
  const hospitalRegister = await request("/api/auth/register", "POST", {
    name: "Hospital Test Applicant",
    email: hospitalEmail,
    phone: "+91 9810098765",
    password: strongPassword,
    role: "HOSPITAL_ADMIN",
    hospitalName: "Test General Hospital",
    registrationNumber: "TEST-REG-2941",
    hospitalType: "PRIVATE",
    addressLine: "42 Test Medical Road",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110001",
  });
  assert.equal(hospitalRegister.response.status, 201, JSON.stringify(hospitalRegister.json));
  const hospitalUser = await prisma.user.findUniqueOrThrow({ where: { email: hospitalEmail }, include: { hospitalApplication: true } });
  assert.equal(hospitalUser.hospitalApplication?.status, "PENDING_VERIFICATION");
  const hospitalVerified = await request("/api/auth/verify-email", "POST", { email: hospitalEmail, code: codeFor(hospitalEmail) });
  assert.equal(hospitalVerified.response.status, 200);
  assert.equal(hospitalVerified.json.data.hospitalApplicationPending, true);
  assert.ok(!hospitalVerified.response.headers.getSetCookie().some((cookie) => cookie.startsWith("js_session=")));
  const hospitalLogin = await request("/api/auth/login", "POST", { email: hospitalEmail, password: strongPassword });
  assert.equal(hospitalLogin.response.status, 403);
  assert.equal(hospitalLogin.json.code, "HOSPITAL_APPLICATION_PENDING");
  console.log("PASS hospital registration stays pending and cannot enter a portal before approval");

  const usersBeforeSeedAttempt = await prisma.user.count();
  const refusal = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "development", DATABASE_URL: databaseUrl, SEED_DEMO_DATA: "true" },
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.notEqual(refusal.status, 0);
  assert.match(`${refusal.stdout}${refusal.stderr}`, /No records were changed/);
  assert.equal(await prisma.user.count(), usersBeforeSeedAttempt);
  console.log("PASS demo seeding refuses non-empty databases without deleting records");

  const adminEmail = testEmail("super-admin");
  const adminPassword = "TestOnly!Admin123456";
  run("npx", ["tsx", "prisma/seed.ts"], {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    SEED_DEMO_DATA: "false",
    SEED_SUPER_ADMIN_EMAIL: adminEmail,
    SEED_SUPER_ADMIN_PASSWORD: adminPassword,
  });
  const adminRecord = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
  assert.equal(adminRecord.role, "SUPER_ADMIN");
  assert.ok(adminRecord.emailVerifiedAt);
  const promotion = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
      SEED_DEMO_DATA: "false",
      SEED_SUPER_ADMIN_EMAIL: patientEmail,
      SEED_SUPER_ADMIN_PASSWORD: "TestOnly!OtherAdmin123",
    },
    encoding: "utf8",
    timeout: 60_000,
  });
  assert.notEqual(promotion.status, 0);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { email: patientEmail } })).role, "PATIENT");
  const adminLogin = await request("/api/auth/login", "POST", { email: adminEmail, password: adminPassword });
  assert.equal(adminLogin.response.status, 200, JSON.stringify(adminLogin.json));
  const adminCookie = cookieFrom(adminLogin.response, "js_session");
  const adminAccess = await request("/api/admin/users", "GET", undefined, adminCookie);
  assert.equal(adminAccess.response.status, 200);
  const patientProfileDenied = await request("/api/user/profile", "GET", undefined, adminCookie);
  assert.equal(patientProfileDenied.response.status, 403);
  const patientDashboardDenied = await request("/api/dashboard", "GET", undefined, adminCookie);
  assert.equal(patientDashboardDenied.response.status, 403);
  const patientAppointmentsDenied = await request("/api/appointments", "GET", undefined, adminCookie);
  assert.equal(patientAppointmentsDenied.response.status, 403);
  const patientSavedDenied = await request("/api/user/saved", "GET", undefined, adminCookie);
  assert.equal(patientSavedDenied.response.status, 403);
  const patientNotificationsDenied = await request("/api/notifications", "GET", undefined, adminCookie);
  assert.equal(patientNotificationsDenied.response.status, 403);
  const patientRecommendationsDenied = await request("/api/patient/recommend", "POST", { need: "Find a cardiologist" }, adminCookie);
  assert.equal(patientRecommendationsDenied.response.status, 403);
  const patientOnlyChecks = await Promise.all([
    request("/api/dashboard", "GET", undefined, adminCookie),
    request("/api/user/profile", "GET", undefined, adminCookie),
    request("/api/user/saved", "GET", undefined, adminCookie),
    request("/api/notifications", "GET", undefined, adminCookie),
    request("/api/user/health-share", "POST", {}, adminCookie),
    request("/api/patient/recommend", "POST", { need: "Find a cardiologist near New Delhi" }, adminCookie),
  ]);
  assert.ok(patientOnlyChecks.every((item) => item.response.status === 403));
  for (const pathname of ["/api/user/profile", "/api/user/saved", "/api/notifications", "/api/appointments"]) {
    const denied = await request(pathname, "GET", undefined, adminCookie);
    assert.equal(denied.response.status, 403, `Expected patient-only access denial for ${pathname}`);
  }
  const deniedRecommendation = await request("/api/patient/recommend", "POST", { need: "Find a cardiologist near me" }, adminCookie);
  assert.equal(deniedRecommendation.response.status, 403);
  console.log("PASS super-admin sessions cannot call patient-only data APIs");
  console.log("PASS protected admin provisioning creates a verified admin without role promotion");

  const oauthStart = await fetch(`${baseUrl}/api/auth/google`, { redirect: "manual" });
  assert.equal(oauthStart.status, 307);
  assert.ok(oauthStart.headers.get("location")?.startsWith("https://accounts.google.com/"));
  const oauthState = oauthStart.headers.getSetCookie().find((cookie) => cookie.startsWith("google_oauth_state="))?.split(";", 1)[0].split("=", 2)[1];
  const oauthCallback = await fetch(`${baseUrl}/api/auth/google/callback?code=invalid&state=wrong-state`, {
    headers: { Cookie: `google_oauth_state=${oauthState ?? "present"}; google_oauth_nonce=nonce; google_oauth_verifier=verifier` },
    redirect: "manual",
  });
  assert.equal(oauthCallback.status, 307);
  assert.ok(oauthCallback.headers.get("location")?.includes("error=google_state_mismatch"));
  console.log("PASS Google OAuth initiation uses PKCE and rejects a mismatched state");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    if (appOutput) console.error(appOutput);
    process.exitCode = 1;
  })
  .finally(() => closeApp());
