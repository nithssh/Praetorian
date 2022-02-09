import { Database } from "sqlite3";
import { ServerPreferences, SessionInfo, VerifiedProfile } from "./datamodels";

export class DB {
  db: Database;
  constructor(filename: string = './database.db') {
    this.db = new Database(filename, (err) => {
      if (err) {
        console.error(err.message);
      } else {
        // console.log("Connected to Database.");
        this.db.run(`CREATE TABLE IF NOT EXISTS ActiveVeriTable (
          email TEXT NOT NULL,
          discord_id TEXT NOT NULL,
          server_id TEXT NOT NULL,
          code INTEGER NOT NULL,
          timestamp INTEGER NOT NULL
          )`
        );

        this.db.run(`CREATE TABLE IF NOT EXISTS VerifiedTable (
          email TEXT NOT NULL,
          discord_id TEXT NOT NULL,
          server_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL
          )`
        );

        this.db.run(`CREATE TABLE IF NOT EXISTS ServerPreferencesTable (
          server_id TEXT PRIMARY KEY UNIQUE,
          prefix TEXT NOT NULL,
          domain TEXT,
          cmd_channel TEXT,
          role_id TEXT
          )`
        );
      }
    });
  }

  async get(sql: string, params: Array<string | null>): Promise<any> {
    const that = this.db;
    return new Promise(function (resolve, reject) {
      that.all(sql, params, function (error, rows) {
        if (error)
          reject(error);
        else
          resolve(rows[0]);
      });
    });
  }

  async getSessionInfo(discord_id: string, server_id: string) {
    let row = await this.get(`SELECT * FROM ActiveVeriTable WHERE discord_id=? AND server_id=?`,
      [discord_id, server_id]);
    return row;
  }

  async setSessionInfo(SessionInfo: SessionInfo) {
    // Check if user is already verified in the server
    let alreadyVerifiedRow = await this.get(`SELECT * FROM VerifiedTable WHERE discord_id=? AND server_id=?`,
      [
        SessionInfo.discord_id,
        SessionInfo.server_id
      ]);
    if (alreadyVerifiedRow !== undefined) {
      return SetSessionInfoResult.ServerMemberAlreadyVerified;
    }

    // Check if email is already taken
    let emailBasedRow = await this.get(`SELECT * FROM VerifiedTable WHERE email=? AND server_id=?`,
      [
        SessionInfo.email,
        SessionInfo.server_id
      ]);
    if (emailBasedRow !== undefined) {
      return SetSessionInfoResult.EmailAlreadyTaken;
    }

    // Check if there is no session currently, by user.
    // This avoids the issue when a user starts two sessions with two different
    // emails, where getSessionCode will return the first sessions code, 
    // even if it was made in error for a wrong email id.
    let currentSessionRow = await this.get(`SELECT * FROM ActiveVeriTable WHERE discord_id=? AND server_id=?`,
      [
        SessionInfo.discord_id,
        SessionInfo.server_id
      ]);
    if (currentSessionRow === undefined) {
      await this.get(
        `INSERT INTO ActiveVeriTable
        (email, discord_id, server_id, code, timestamp) 
        VALUES (?, ?, ?, ?, ?)`,
        [
          SessionInfo.email,
          SessionInfo.discord_id,
          SessionInfo.server_id,
          SessionInfo.verification_code,
          SessionInfo.timestamp,
        ]);
      return SetSessionInfoResult.SuccessfullyCreated;
    }

    // check if session in DB has expired
    let currentDate = new Date();
    if (currentDate.getTime() - currentSessionRow.timestamp <= 900000) {
      return SetSessionInfoResult.SessionAlreadyActive;
    } else {
      // session has expired, create the new one
      await this.deleteSessionsByUser(SessionInfo.discord_id, SessionInfo.server_id);
      await this.get(
        `INSERT INTO ActiveVeriTable
        (email, discord_id, server_id, code, timestamp) 
        VALUES (?, ?, ?, ?, ?)`,
        [
          SessionInfo.email,
          SessionInfo.discord_id,
          SessionInfo.server_id,
          SessionInfo.verification_code,
          SessionInfo.timestamp,
        ]);
      return SetSessionInfoResult.SuccessfullyUpdated;
    }
  }

  async deleteSessionsByEmail(email: string, server_id: string) {
    await this.get(
      `DELETE FROM ActiveVeriTable
      WHERE email=? AND server_id=?`,
      [
        email,
        server_id
      ]
    );
  }

  async deleteSessionsByUser(discord_id: string, server_id: string) {
    await this.get(
      `DELETE FROM ActiveVeriTable
      WHERE discord_id=? AND server_id=?`,
      [
        discord_id,
        server_id
      ]
    );
  }


  async getSessionCode(discord_id: string, server_id: string): Promise<GetSessionCodeResult | number> {
    let row = await this.get(`SELECT * FROM ActiveVeriTable WHERE discord_id=? AND server_id=?`,
      [discord_id, server_id]);

    if (row === undefined) {
      return GetSessionCodeResult.NoActiveSession;
    } else {
      if (new Date().getTime() - row.timestamp > 900000) {
        return GetSessionCodeResult.LastSessionExpired;
      } else {
        return row.code;
      }
    }
  };

  // Maybe return class instance instead of raw row data
  async getVerifiedUser(discord_id: string, server_id: string): Promise<any> {
    let verifiedUser = await this.get(`SELECT * FROM VerifiedTable
      WHERE discord_id=? AND server_id=?`,
      [
        discord_id,
        server_id
      ]);
    return verifiedUser;
  }

  async setVerifiedUser(VerifiedEmail: VerifiedProfile) {
    await this.get(
      `INSERT INTO VerifiedTable
      (email, discord_id, server_id, timestamp) 
      VALUES (?, ?, ?, ?)`,
      [
        VerifiedEmail.email,
        VerifiedEmail.discord_id,
        VerifiedEmail.server_id,
        VerifiedEmail.timestamp
      ]
    );
  }

  async deleteVerifiedUser(VerifiedEmail: VerifiedProfile) {
    await this.get(
      `DELETE FROM VerifiedTable
       WHERE server_id=? AND (discord_id=? OR email=?)`,
      [
        VerifiedEmail.server_id,
        VerifiedEmail.discord_id,
        VerifiedEmail.email
      ]);
  }

  async getServerPreferences(server_id: string): Promise<any> {
    let result = await this.get(`SELECT * FROM ServerPreferencesTable WHERE server_id=?`, [server_id]);
    return result;
  }

  async setSeverPreferences(ServerPreferences: ServerPreferences) {
    if (await this.doesServerPreferenceExist(ServerPreferences.server_id)) {
      await this.get(`
        UPDATE ServerPreferencesTable
        SET domain=?, prefix=?, cmd_channel=?, role_id=?
        WHERE server_id=?`,
        [
          ServerPreferences.domains,
          ServerPreferences.prefix,
          ServerPreferences.cmd_channel,
          ServerPreferences.role_id,
          ServerPreferences.server_id
        ]
      );
    } else {
      await this.get(
        `INSERT INTO ServerPreferencesTable (server_id, prefix, domain, cmd_channel, role_id) VALUES (?, ?, ?, ?, ?)`,
        [
          ServerPreferences.server_id,
          ServerPreferences.prefix,
          ServerPreferences.domains,
          ServerPreferences.cmd_channel,
          ServerPreferences.role_id
        ]
      );
    }
  }

  private async doesServerPreferenceExist(server_id: string) {
    let sp = await this.getServerPreferences(server_id);
    return (sp !== undefined);
  }

}

export enum GetSessionCodeResult {
  NoActiveSession,
  LastSessionExpired
}

export enum SetSessionInfoResult {
  ServerMemberAlreadyVerified,
  EmailAlreadyTaken,
  SuccessfullyCreated,
  SessionAlreadyActive,
  SuccessfullyUpdated
}
