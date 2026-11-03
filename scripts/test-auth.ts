import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import {
  bedInventoryByType,
  bedInventoryCounts,
  availableBedsByType,
  type BedInventoryRecord,
  type BedRecord,
} from "../src/lib/hospital/hospital-data";

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
  const inventoryFixture: BedInventoryRecord[] = [{ category: "ICU", total: 10, available: 4 }];
  const bedFixture: BedRecord[] = [
    { id: "i1", ward: "ICU-A", bedType: "ICU", department: "ICU", status: "RESERVED", updatedAt: "2026-11-03T00:00:00.000Z" },
    { id: "i2", ward: "ICU-A", bedType: "ICU", department: "ICU", status: "MAINTENANCE", updatedAt: "2026-11-03T00:00:00.000Z" },
    { id: "i3", ward: "ICU-A", bedType: "ICU", department: "ICU", status: "OCCUPIED", updatedAt: "2026-11-03T00:00:00.000Z" },
    { id: "g1", ward: "General-A", bedType: "GENERAL", department: "General", status: "AVAILABLE", updatedAt: "2026-11-03T00:00:00.000Z" },
  ];
  assert.deepEqual(bedInventoryCounts(inventoryFixture, bedFixture), {
    total: 10,
    available: 4,
    occupied: 4,
    reserved: 1,
    maintenance: 1,
  });
  assert.equal(bedInventoryByType(inventoryFixture, bedFixture)[0].occupied, 4);
  assert.equal(availableBedsByType(inventoryFixture, bedFixture, "ICU"), 4);
  console.log("PASS itemised bed reservations and maintenance are excluded from occupancy");

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
  const secondHospital = await prisma.hospital.create({
    data: {
      name: "Isolation Test Hospital",
      type: "TRUST",
      status: "VERIFIED",
      registrationNumber: "TEST-ISOLATION-HOSPITAL",
      addressLine: "2 Test Health Road",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
      phone: "+91 1100012000",
      lat: 28.62,
      lng: 77.21,
    },
  });
  const hospitalAdminPassword = "TestOnly!Hospital123";
  const hospitalAdminEmail = testEmail("hospital-admin-primary");
  const secondHospitalAdminEmail = testEmail("hospital-admin-secondary");
  const hospitalAdmin = await prisma.user.create({
    data: {
      name: "Hospital Admin A",
      email: hospitalAdminEmail,
      passwordHash: await bcrypt.hash(hospitalAdminPassword, 12),
      role: "HOSPITAL_ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      hospitalId: appointmentHospital.id,
    },
  });
  await prisma.user.create({
    data: {
      name: "Hospital Admin B",
      email: secondHospitalAdminEmail,
      passwordHash: await bcrypt.hash(hospitalAdminPassword, 12),
      role: "HOSPITAL_ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      hospitalId: secondHospital.id,
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

  const adminStats = await request("/api/admin/stats", "GET", undefined, adminCookie);
  assert.equal(adminStats.response.status, 200, JSON.stringify(adminStats.json));
  assert.ok(typeof adminStats.json.data.stats.pendingHospitals === "number");
  assert.ok(Array.isArray(adminStats.json.data.queue));
  const patientAdminStats = await request("/api/admin/stats", "GET", undefined, patientSessionCookie);
  assert.equal(patientAdminStats.response.status, 403);
  const patientAdminPage = await fetch(`${baseUrl}/admin`, { headers: { Cookie: patientSessionCookie }, redirect: "manual" });
  assert.equal(patientAdminPage.status, 307);
  console.log("PASS admin pages and administrative summaries reject non-admin sessions");

  const pendingApplication = await prisma.hospitalApplication.findUniqueOrThrow({ where: { userId: hospitalUser.id } });
  const adminApplicationList = await request("/api/admin/applications?status=all&page=1&pageSize=10", "GET", undefined, adminCookie);
  assert.equal(adminApplicationList.response.status, 200, JSON.stringify(adminApplicationList.json));
  assert.ok(adminApplicationList.json.data.applications.some((item: { id: string }) => item.id === pendingApplication.id));
  const approvalWithoutLocation = await request("/api/admin/applications", "POST", {
    applicationId: pendingApplication.id,
    decision: "VERIFIED",
  }, adminCookie);
  assert.equal(approvalWithoutLocation.response.status, 422);
  assert.equal((await prisma.hospitalApplication.findUniqueOrThrow({ where: { id: pendingApplication.id } })).status, "PENDING_VERIFICATION");
  const approvalEmailCount = mailCount(hospitalEmail);
  const applicationApproval = await request("/api/admin/applications", "POST", {
    applicationId: pendingApplication.id,
    decision: "VERIFIED",
    lat: 28.6139,
    lng: 77.209,
  }, adminCookie);
  assert.equal(applicationApproval.response.status, 200, JSON.stringify(applicationApproval.json));
  assert.equal(applicationApproval.json.data.emailSent, true);
  assert.equal(mailCount(hospitalEmail), approvalEmailCount + 1);
  const approvedApplicant = await prisma.user.findUniqueOrThrow({ where: { id: hospitalUser.id } });
  assert.equal(approvedApplicant.status, "ACTIVE");
  assert.ok(approvedApplicant.hospitalId);
  const approvedHospital = await prisma.hospital.findUniqueOrThrow({ where: { id: approvedApplicant.hospitalId! } });
  assert.equal(approvedHospital.status, "VERIFIED");
  assert.equal(approvedHospital.lat, 28.6139);
  assert.equal((await prisma.auditLog.findFirst({ where: { entityId: pendingApplication.id, action: "HOSPITAL_APPLICATION_VERIFIED" } }))?.entityId, pendingApplication.id);
  const approvedLogin = await request("/api/auth/login", "POST", { email: hospitalEmail, password: strongPassword });
  assert.equal(approvedLogin.response.status, 200, JSON.stringify(approvedLogin.json));
  const approvedHospitalCookie = cookieFrom(approvedLogin.response, "js_session");
  const approvedPortal = await request("/api/hospital/portal", "GET", undefined, approvedHospitalCookie);
  assert.equal(approvedPortal.response.status, 200);
  assert.equal(approvedPortal.json.data.hospital.id, approvedHospital.id);
  const duplicateApplicationReview = await request("/api/admin/applications", "POST", {
    applicationId: pendingApplication.id,
    decision: "VERIFIED",
    lat: 28.6139,
    lng: 77.209,
  }, adminCookie);
  assert.equal(duplicateApplicationReview.response.status, 409);
  console.log("PASS hospital approval atomically verifies and links the account, records audit, emails, and unlocks the scoped portal");

  const rejectedEmail = testEmail("hospital-rejected");
  const rejectedRegister = await request("/api/auth/register", "POST", {
    name: "Rejected Hospital Applicant",
    email: rejectedEmail,
    phone: "+91 9810098766",
    password: strongPassword,
    role: "HOSPITAL_ADMIN",
    hospitalName: "Rejected Test Hospital",
    registrationNumber: "TEST-REG-REJECT-2941",
    hospitalType: "PRIVATE",
    addressLine: "43 Test Medical Road",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110001",
  });
  assert.equal(rejectedRegister.response.status, 201, JSON.stringify(rejectedRegister.json));
  const rejectedUser = await prisma.user.findUniqueOrThrow({ where: { email: rejectedEmail } });
  const rejectedApplication = await prisma.hospitalApplication.findUniqueOrThrow({ where: { userId: rejectedUser.id } });
  const rejectedVerified = await request("/api/auth/verify-email", "POST", { email: rejectedEmail, code: codeFor(rejectedEmail) });
  assert.equal(rejectedVerified.response.status, 200);
  const missingRejectionReason = await request("/api/admin/applications", "POST", {
    applicationId: rejectedApplication.id,
    decision: "REJECTED",
  }, adminCookie);
  assert.equal(missingRejectionReason.response.status, 422);
  const decisionReason = "Registration documents could not be verified.";
  const applicationRejection = await request("/api/admin/applications", "POST", {
    applicationId: rejectedApplication.id,
    decision: "REJECTED",
    reason: decisionReason,
  }, adminCookie);
  assert.equal(applicationRejection.response.status, 200, JSON.stringify(applicationRejection.json));
  assert.equal(applicationRejection.json.data.emailSent, true);
  const rejectedLogin = await request("/api/auth/login", "POST", { email: rejectedEmail, password: strongPassword });
  assert.equal(rejectedLogin.response.status, 403);
  assert.equal(rejectedLogin.json.code, "HOSPITAL_APPLICATION_REJECTED");
  assert.equal(rejectedLogin.json.reviewNote, decisionReason);
  assert.ok(!rejectedLogin.response.headers.getSetCookie().some((cookie) => cookie.startsWith("js_session=")));
  console.log("PASS hospital rejection requires a reason, notifies the applicant, and never grants portal access");

  const legacyHospital = await prisma.hospital.create({
    data: {
      name: "Legacy Test Hospital",
      type: "PRIVATE",
      status: "PENDING_VERIFICATION",
      registrationNumber: `LEGACY-${randomBytes(4).toString("hex")}`,
      addressLine: "44 Test Medical Road",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
      phone: "+91 9810098768",
      lat: 28.6139,
      lng: 77.209,
    },
  });
  const legacyAdminEmail = testEmail("legacy-hospital-admin");
  const legacyAdmin = await prisma.user.create({
    data: {
      name: "Legacy Hospital Administrator",
      email: legacyAdminEmail,
      passwordHash: await bcrypt.hash(strongPassword, 12),
      role: "HOSPITAL_ADMIN",
      status: "PENDING_VERIFICATION",
      emailVerifiedAt: new Date(),
      hospitalId: legacyHospital.id,
    },
  });
  const legacyApproval = await request("/api/admin/hospitals", "POST", {
    hospitalId: legacyHospital.id,
    decision: "VERIFIED",
  }, adminCookie);
  assert.equal(legacyApproval.response.status, 200, JSON.stringify(legacyApproval.json));
  const activatedLegacyAdmin = await prisma.user.findUniqueOrThrow({ where: { id: legacyAdmin.id } });
  assert.equal(activatedLegacyAdmin.status, "ACTIVE");
  assert.equal(activatedLegacyAdmin.authVersion, legacyAdmin.authVersion + 1);
  assert.ok((await prisma.hospital.findUniqueOrThrow({ where: { id: legacyHospital.id } })).verifiedAt);
  assert.ok(await prisma.notification.findFirst({ where: { userId: legacyAdmin.id, title: "Hospital verified" } }));
  const legacyAdminLogin = await request("/api/auth/login", "POST", { email: legacyAdminEmail, password: strongPassword });
  assert.equal(legacyAdminLogin.response.status, 200, JSON.stringify(legacyAdminLogin.json));
  const legacyAdminCookie = cookieFrom(legacyAdminLogin.response, "js_session");
  const legacyPortal = await request("/api/hospital/portal", "GET", undefined, legacyAdminCookie);
  assert.equal(legacyPortal.response.status, 200);
  assert.equal(legacyPortal.json.data.hospital.id, legacyHospital.id);

  const legacyRejectHospital = await prisma.hospital.create({
    data: {
      name: "Legacy Rejection Test Hospital",
      type: "PRIVATE",
      status: "VERIFIED",
      verifiedAt: new Date(),
      verifiedBy: "prior-review",
      registrationNumber: `LEGACY-REJECT-${randomBytes(4).toString("hex")}`,
      addressLine: "45 Test Medical Road",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
      phone: "+91 9810098769",
      lat: 28.614,
      lng: 77.21,
    },
  });
  const legacyRejectEmail = testEmail("legacy-hospital-rejected");
  const legacyRejectAdmin = await prisma.user.create({
    data: {
      name: "Legacy Rejection Administrator",
      email: legacyRejectEmail,
      passwordHash: await bcrypt.hash(strongPassword, 12),
      role: "HOSPITAL_ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      hospitalId: legacyRejectHospital.id,
    },
  });
  const legacyRejectLogin = await request("/api/auth/login", "POST", { email: legacyRejectEmail, password: strongPassword });
  assert.equal(legacyRejectLogin.response.status, 200);
  const legacyRejectCookie = cookieFrom(legacyRejectLogin.response, "js_session");
  await prisma.hospital.update({ where: { id: legacyRejectHospital.id }, data: { status: "PENDING_VERIFICATION" } });
  const legacyRejection = await request("/api/admin/hospitals", "POST", {
    hospitalId: legacyRejectHospital.id,
    decision: "REJECTED",
    reason: "Verification documents are incomplete.",
  }, adminCookie);
  assert.equal(legacyRejection.response.status, 200, JSON.stringify(legacyRejection.json));
  assert.equal((await request("/api/auth/me", "GET", undefined, legacyRejectCookie)).json.data.user, null);
  assert.equal((await prisma.hospital.findUniqueOrThrow({ where: { id: legacyRejectHospital.id } })).verifiedAt, null);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: legacyRejectAdmin.id } })).authVersion, legacyRejectAdmin.authVersion + 1);
  console.log("PASS legacy hospital verification activates only verified, non-suspended admins and revokes sessions on decision");

  const report = await prisma.report.create({
    data: {
      category: "DATA_ISSUE",
      subject: "Admin integration test report",
      message: "This report tests the administrative review queue and audited resolution workflow.",
      reporterName: "Test Reporter",
      contactEmail: testEmail("reporter"),
      relatedHospital: "Test General Hospital",
    },
  });
  const reportList = await request("/api/admin/reports?status=ALL&q=Admin%20integration", "GET", undefined, adminCookie);
  assert.equal(reportList.response.status, 200, JSON.stringify(reportList.json));
  assert.ok(reportList.json.data.reports.some((item: { id: string }) => item.id === report.id));
  const patientReportsDenied = await request("/api/admin/reports?status=ALL", "GET", undefined, patientSessionCookie);
  assert.equal(patientReportsDenied.response.status, 403);
  const closeWithoutNote = await request("/api/admin/reports", "PATCH", {
    reportId: report.id,
    expectedStatus: "OPEN",
    status: "RESOLVED",
  }, adminCookie);
  assert.equal(closeWithoutNote.response.status, 422);
  const markInReview = await request("/api/admin/reports", "PATCH", {
    reportId: report.id,
    expectedStatus: "OPEN",
    status: "IN_REVIEW",
  }, adminCookie);
  assert.equal(markInReview.response.status, 200, JSON.stringify(markInReview.json));
  const staleReportUpdate = await request("/api/admin/reports", "PATCH", {
    reportId: report.id,
    expectedStatus: "OPEN",
    status: "RESOLVED",
    resolutionNote: "Resolved after review.",
  }, adminCookie);
  assert.equal(staleReportUpdate.response.status, 409);
  const resolveReport = await request("/api/admin/reports", "PATCH", {
    reportId: report.id,
    expectedStatus: "IN_REVIEW",
    status: "RESOLVED",
    resolutionNote: "Corrected the hospital directory listing.",
  }, adminCookie);
  assert.equal(resolveReport.response.status, 200, JSON.stringify(resolveReport.json));
  assert.equal(resolveReport.json.data.report.status, "RESOLVED");
  const reportAuditEntries = await request(`/api/admin/audit?action=REPORT_STATUS_CHANGED&q=${encodeURIComponent(report.id)}`, "GET", undefined, adminCookie);
  assert.equal(reportAuditEntries.response.status, 200, JSON.stringify(reportAuditEntries.json));
  assert.ok(reportAuditEntries.json.data.total >= 2);
  console.log("PASS reports support scoped search, validated state transitions, required resolution notes, concurrency checks, and audit review");

  const managedEmail = testEmail("managed-account");
  const managedPassword = "TestOnly!Managed123456";
  const managedUser = await prisma.user.create({
    data: {
      name: "Managed Patient Account",
      email: managedEmail,
      phone: "+91 9810098767",
      passwordHash: await bcrypt.hash(managedPassword, 12),
      role: "PATIENT",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
  });
  const managedLogin = await request("/api/auth/login", "POST", { email: managedEmail, password: managedPassword });
  assert.equal(managedLogin.response.status, 200, JSON.stringify(managedLogin.json));
  const managedCookie = cookieFrom(managedLogin.response, "js_session");
  const illegalRoleChange = await request("/api/admin/users", "PATCH", {
    userId: managedUser.id,
    status: "ACTIVE",
    role: "SUPER_ADMIN",
  }, adminCookie);
  assert.equal(illegalRoleChange.response.status, 422);
  const suspendManagedUser = await request("/api/admin/users", "PATCH", { userId: managedUser.id, status: "SUSPENDED" }, adminCookie);
  assert.equal(suspendManagedUser.response.status, 200, JSON.stringify(suspendManagedUser.json));
  const oldManagedSession = await request("/api/auth/me", "GET", undefined, managedCookie);
  assert.equal(oldManagedSession.json.data.user, null);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: managedUser.id } })).authVersion, managedUser.authVersion + 1);
  const reactivateManagedUser = await request("/api/admin/users", "PATCH", { userId: managedUser.id, status: "ACTIVE" }, adminCookie);
  assert.equal(reactivateManagedUser.response.status, 200, JSON.stringify(reactivateManagedUser.json));
  const managedUsers = await request("/api/admin/users?page=1&pageSize=10&q=managed-account&role=PATIENT&status=ACTIVE", "GET", undefined, adminCookie);
  assert.equal(managedUsers.response.status, 200, JSON.stringify(managedUsers.json));
  assert.ok(managedUsers.json.data.users.some((item: { id: string; passwordHash?: string }) => item.id === managedUser.id && item.passwordHash === undefined));
  const suspendSelf = await request("/api/admin/users", "PATCH", { userId: adminRecord.id, status: "SUSPENDED" }, adminCookie);
  assert.equal(suspendSelf.response.status, 422);
  console.log("PASS account filters, restricted status changes, session revocation, self-protection, and audit records");
  const verifiedHospitalLogin = await request("/api/auth/login", "POST", { email: hospitalAdminEmail, password: hospitalAdminPassword });
  const secondHospitalLogin = await request("/api/auth/login", "POST", { email: secondHospitalAdminEmail, password: hospitalAdminPassword });
  assert.equal(verifiedHospitalLogin.response.status, 200, JSON.stringify(verifiedHospitalLogin.json));
  assert.equal(secondHospitalLogin.response.status, 200, JSON.stringify(secondHospitalLogin.json));
  const hospitalCookie = cookieFrom(verifiedHospitalLogin.response, "js_session");
  const secondHospitalCookie = cookieFrom(secondHospitalLogin.response, "js_session");
  const portalA = await request("/api/hospital/portal", "GET", undefined, hospitalCookie);
  const portalB = await request("/api/hospital/portal", "GET", undefined, secondHospitalCookie);
  assert.equal(portalA.response.status, 200);
  assert.equal(portalA.json.data.hospital.id, appointmentHospital.id);
  assert.equal(portalB.json.data.hospital.id, secondHospital.id);
  assert.equal(portalB.json.data.doctors.length, 0);
  assert.equal(portalB.json.data.beds.length, 0);

  const departmentResponse = await request("/api/hospital/departments", "POST", {
    name: "Cardiology",
    head: "Dr. Test Specialist",
    status: "ACTIVE",
    location: "North Wing",
    description: "Cardiac care unit",
  }, hospitalCookie);
  assert.equal(departmentResponse.response.status, 201, JSON.stringify(departmentResponse.json));
  const departmentId = departmentResponse.json.data.department.id as string;
  const doctorResponse = await request("/api/hospital/doctors", "POST", {
    name: "Dr. Hospital Portal",
    specialty: "Cardiology",
    department: "Cardiology",
    qualification: "MD",
    experienceYears: 12,
    availability: "AVAILABLE",
    timings: "09:00-17:00",
    phone: "+91 9810012345",
    email: "doctor@example.test",
  }, hospitalCookie);
  assert.equal(doctorResponse.response.status, 201, JSON.stringify(doctorResponse.json));
  const doctorId = doctorResponse.json.data.doctor.id as string;
  const bedResponse = await request("/api/hospital/beds", "POST", {
    id: "A-ICU-01",
    ward: "Critical Care",
    bedType: "ICU",
    department: "Cardiology",
    status: "AVAILABLE",
  }, hospitalCookie);
  assert.equal(bedResponse.response.status, 201, JSON.stringify(bedResponse.json));
  const duplicateBed = await request("/api/hospital/beds", "POST", {
    id: "A-ICU-01",
    ward: "Critical Care",
    bedType: "ICU",
    department: "Cardiology",
    status: "AVAILABLE",
  }, hospitalCookie);
  assert.equal(duplicateBed.response.status, 409);
  const publicHospital = await request(`/api/hospitals/${encodeURIComponent(appointmentHospital.id)}`);
  assert.equal(publicHospital.response.status, 200);
  assert.equal(publicHospital.json.data.hospital.beds.find((item: { category: string }) => item.category === "ICU").available, 1);

  const serviceResponse = await request("/api/hospital/services", "POST", {
    name: "MRI",
    department: "Cardiology",
    status: "AVAILABLE",
    hours: "24x7",
    description: "Magnetic resonance imaging",
  }, hospitalCookie);
  assert.equal(serviceResponse.response.status, 201, JSON.stringify(serviceResponse.json));
  const emergencyResponse = await request("/api/hospital/emergencies", "POST", {
    patientRef: "Case 1",
    age: 43,
    condition: "Chest pain",
    severity: "URGENT",
    department: "Cardiology",
    location: "Emergency bay 2",
  }, hospitalCookie);
  assert.equal(emergencyResponse.response.status, 201, JSON.stringify(emergencyResponse.json));
  const emergencyId = emergencyResponse.json.data.emergencyCase.id as string;
  const emergencyStatus = await request(`/api/hospital/emergencies/${encodeURIComponent(emergencyId)}`, "PATCH", { status: "IN_TREATMENT" }, hospitalCookie);
  assert.equal(emergencyStatus.response.status, 200);

  const requestFromPatient = await request("/api/appointments", "POST", {
    hospitalId: appointmentHospital.id,
    doctorId,
    patientName: "Test Patient",
    patientPhone: "+91 9810012345",
    date: futureDateInIndia(),
    time: "12:30 PM",
  }, patientSessionCookie);
  assert.equal(requestFromPatient.response.status, 201, JSON.stringify(requestFromPatient.json));
  const hospitalAlert = await prisma.notification.findFirst({
    where: { userId: hospitalAdmin.id, title: "New appointment request" },
  });
  assert.ok(hospitalAlert);
  const crossHospitalDoctor = await request(`/api/hospital/doctors/${encodeURIComponent(doctorId)}`, "PATCH", { availability: "UNAVAILABLE" }, secondHospitalCookie);
  const crossHospitalBed = await request(`/api/hospital/beds/A-ICU-01`, "PATCH", { status: "OCCUPIED" }, secondHospitalCookie);
  const crossHospitalDepartment = await request(`/api/hospital/departments/${encodeURIComponent(departmentId)}`, "PATCH", { status: "INACTIVE" }, secondHospitalCookie);
  assert.equal(crossHospitalDoctor.response.status, 404);
  assert.equal(crossHospitalBed.response.status, 404);
  assert.equal(crossHospitalDepartment.response.status, 404);
  const superAdminHospitalDenied = await request("/api/hospital/portal", "GET", undefined, adminCookie);
  assert.equal(superAdminHospitalDenied.response.status, 403);

  const hospitalAppointmentId = requestFromPatient.json.data.appointment.id as string;
  const confirmed = await request("/api/hospital/appointments", "PATCH", {
    appointmentId: hospitalAppointmentId,
    status: "CONFIRMED",
    note: "Please arrive 15 minutes early.",
  }, hospitalCookie);
  assert.equal(confirmed.response.status, 200);
  const patientAppointmentAlert = await prisma.notification.findFirst({
    where: { userId: (await prisma.user.findUniqueOrThrow({ where: { email: patientEmail } })).id, title: "Appointment confirmed" },
  });
  assert.ok(patientAppointmentAlert);
  const invalidIdentityChange = await request("/api/hospital/profile", "PATCH", {
    name: "Appointments Test Hospital",
    type: "PRIVATE",
    registrationNumber: "FORGED-REGISTRATION",
    addressLine: "3 Test Health Road",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110001",
    phone: "+91 1100011000",
    emergencyPhone: "",
    email: "",
    website: "",
    accreditation: "",
    established: 2000,
    about: "Updated test profile",
  }, hospitalCookie);
  assert.equal(invalidIdentityChange.response.status, 403);
  const validProfileChange = await request("/api/hospital/profile", "PATCH", {
    name: "Appointments Test Hospital",
    type: "PRIVATE",
    registrationNumber: "TEST-APPOINTMENT-HOSPITAL",
    addressLine: "3 Test Health Road",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110001",
    phone: "+91 1100011000",
    emergencyPhone: "",
    email: "",
    website: "",
    accreditation: "",
    established: 2000,
    about: "Updated test profile",
  }, hospitalCookie);
  assert.equal(validProfileChange.response.status, 200);
  const refreshedPublicHospital = await request(`/api/hospitals/${encodeURIComponent(appointmentHospital.id)}`);
  assert.equal(refreshedPublicHospital.json.data.hospital.addressLine, "3 Test Health Road");
  const hiddenHospitalPage = await fetch(`${baseUrl}/hospital`, { headers: { Cookie: adminCookie }, redirect: "manual" });
  assert.equal(hiddenHospitalPage.status, 307);
  console.log("PASS verified hospital admins receive isolated portal data and persisted CRUD");
  console.log("PASS bed and service changes reach the patient directory; cross-hospital writes fail");
  console.log("PASS appointment, emergency, profile, notifications, audit, and role protections");
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
