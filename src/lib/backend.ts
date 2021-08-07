import { sendMail } from "./email";
import { ServerPreferences, SessionInfo, VerifiedEmail } from "./datamodels";
import { DB, SessionCodeReturns, SessionInfoReturn } from "./db";

const db = new DB();

function createVerficationSession(email: string, discord_id: string, server_id: string) {
  let code = generateCode();
  let timestamp = new Date().getTime();
  let session = new SessionInfo(email, discord_id, server_id, code.toString(), timestamp.toString());
  return session;
}

export async function startVerificationProcess(email: string, discord_id: string, server_id: string) {
  let session = createVerficationSession(email, discord_id, server_id);
  let status = await db.storeSessionInfo(session);

  if (status == SessionInfoReturn.SuccessfullyCreated || status == SessionInfoReturn.SuccessfullyUpdated) {
    sendMail(session.email, session.verification_code);
  }
  return status;
}

export async function validateCode(userCode: string, discord_id: string, server_id: string): Promise<CodeValidationReturn | SessionCodeReturns> {
  let dbCode = await db.getSessionCode(discord_id, server_id);
  if (dbCode in SessionCodeReturns) {
    return dbCode as SessionCodeReturns;
  }

  if (userCode == dbCode.toString()) {
    storeVerifiedEmail(discord_id, server_id);
    return CodeValidationReturn.ValidationSuccess;
  } else {
    return CodeValidationReturn.ValidationFailed;
  };
}

async function storeVerifiedEmail(discord_id: string, server_id: string) {
  let row = await db.getSessionInfo(discord_id, server_id);
  let verifiedProfile = new VerifiedEmail(
    row.email,
    row.discord_id,
    row.server_id,
    row.timestamp,
  );
  await db.storeVerifiedUser(verifiedProfile);
};


export async function queryServerPreferences(server_id: string) {
  let serverPrefs = await db.getServerPreferences(server_id);
  return serverPrefs;
}

export function setServerPreferences(ServerPreferences: ServerPreferences) {
  db.setSeverPreferences(ServerPreferences);
}

export async function createServerPreferences(server_id: string) {
  await db.createServerPreferences(server_id);
}

export async function deleteVerifiedUser(discord_id: string, server_id: string) {
  let row = await db.getVerifiedUser(discord_id, server_id);
  if (row !== undefined) {
    db.deleteVerifiedUser(new VerifiedEmail(
      row.email,
      row.discord_id,
      row.server_id,
      row.timestamp
    ));
  }
}

function generateCode(): number {
  return randomIntFromInterval(100000, 999999);
}

// Generate random integer, within min and max included range
function randomIntFromInterval(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export enum CodeValidationReturn {
  ValidationSuccess,
  ValidationFailed,
}