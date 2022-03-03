import Database from 'better-sqlite3';
import { ServerPreferences, SessionInfo, VerifiedProfile } from "./datamodels";

export class DB {
  db: Database.Database;
  constructor(filename: string = './database.db') {
    this.db = new Database(filename);

    let avt = this.db.prepare(`CREATE TABLE IF NOT EXISTS ActiveVeriTable (
      email TEXT NOT NULL,
      discord_id TEXT NOT NULL,
      server_id TEXT NOT NULL,
      code INTEGER NOT NULL,
      timestamp INTEGER NOT NULL)`
    );

    let vt = this.db.prepare(`CREATE TABLE IF NOT EXISTS VerifiedTable (
          email TEXT NOT NULL,
          discord_id TEXT NOT NULL,
          server_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL)`
    );

    let spt = this.db.prepare(`CREATE TABLE IF NOT EXISTS ServerPreferencesTable (
          server_id TEXT PRIMARY KEY UNIQUE,
          prefix TEXT NOT NULL,
          domain TEXT,
          cmd_channel TEXT,
          role_id TEXT)`
    );

    avt.run();
    vt.run();
    spt.run();
  }

  // Runs the query that don't return.
  async exec(sql: string, params: Array<string | null>): Promise<any> {
    const that = this.db;
    return new Promise(function (resolve, reject) {
      let stmt = that.prepare(sql);
      try {
        stmt.run(params);
        resolve(null);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Runs the query and returns the result array. MUST use #exec() for statements
  // that don't return anything. Returns the first row in the result.
  async get(sql: string, params: Array<string | null>): Promise<any> {
    const that = this.db;
    return new Promise(function (resolve, reject) {
      let stmt = that.prepare(sql);
      try {
        let result = stmt.all(params);
        if (result.length === 0)
          resolve(undefined);
        else
          resolve(result[0]);
      } catch (err) {
        reject(err);
      }
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
      await this.exec(
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
      await this.exec(
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
    await this.exec(
      `DELETE FROM ActiveVeriTable
      WHERE email=? AND server_id=?`,
      [
        email,
        server_id
      ]
    );
  }

  async deleteSessionsByUser(discord_id: string, server_id: string) {
    await this.exec(
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
      if (Date.now() - row.timestamp > 900000) {
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
    await this.exec(
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
    await this.exec(
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
      await this.exec(`
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
      await this.exec(
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
  NoActiveSession = "NoActiveSession",
  LastSessionExpired = "LastSessionExpired"
}

export enum SetSessionInfoResult {
  ServerMemberAlreadyVerified,
  EmailAlreadyTaken,
  SuccessfullyCreated,
  SessionAlreadyActive,
  SuccessfullyUpdated
}
