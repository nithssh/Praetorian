import { sendMail } from "./email";
import { ServerPreferences, SessionInfo, VerifiedEmail } from "./datamodels";
import { DB } from "./db";

const db = new DB();

function createVerficationSession(email: string, discord_id: string, server_id: string) {
  let code = generateCode();
  let timestamp = new Date().getTime();
  let session = new SessionInfo(email, discord_id, server_id, code.toString(), timestamp.toString());
  return session;
}

export function startVerificationProcess(email: string, discord_id: string, server_id: string, callback: (returnCode: string) => void) {
  let session = createVerficationSession(email, discord_id, server_id);
  db.storeSessionInfo(session, (status) => {
    if (status == "ServerMemberAlreadyVerified") {
      callback("ServerMemberAlreadyVerified");
    } else if (status == "EmailAlreadyTaken") {
      callback("EmailAlreadyTaken");
    } else if (status == "SuccessfullyCreated") {
      sendMail(session.email, session.verification_code);
      callback("SuccessfullyCreated");
    } else if (status == "SessionAlreadyActive") {
      callback("SessionAlreadyActive");
    } else if (status == "SuccessfullyUpdated") {
      sendMail(session.email, session.verification_code);
      callback("SuccessfullyUpdated");
    } else {
      console.error("storeSessionInfo returned unexpected value.")
    }
  });
}

export function validateCode(userCode: string, discord_id: string, server_id: string, callback: (returnCode: boolean | string) => void) {
  db.getSessionCode(discord_id, server_id, (dbCode) => {
    if (dbCode == "NoActiveSession") {
      callback("NoActiveSession");
    } else if (dbCode == "LastSessionExpired") {
      callback("LastSessionExpired");
    } else if (userCode == dbCode) {
      storeVerifiedEmail(discord_id, server_id);
      callback(true);
    } else {
      callback(false);
    }
  });
}

function storeVerifiedEmail(discord_id: string, server_id: string) {
  db.getSessionInfo(discord_id, server_id, function (row: any) {
    let verifiedProfile = new VerifiedEmail(
      row.email,
      row.discord_id,
      row.server_id,
      row.timestamp,
    );
    db.storeVerifiedUser(verifiedProfile);
  });
}

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
  } else {
    // console.log("User that left wasnt verified");
  }
}


function generateCode(): number {
  return randomIntFromInterval(100000, 999999);
}

// Generate random integer, within min and max included range
function randomIntFromInterval(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
