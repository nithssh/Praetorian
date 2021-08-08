export class SessionInfo {
  email: string;
  discord_id: string;
  server_id: string;
  verification_code: string;
  timestamp: string;

  constructor(email: string, discord_id: string, server_id: string, code: string, timestamp: string) {
    this.email = email;
    this.discord_id = discord_id;
    this.server_id = server_id;
    this.verification_code = code;
    this.timestamp = timestamp;
  }
}

export class VerifiedProfile {
  email: string;
  discord_id: string;
  server_id: string;
  timestamp: string;

  constructor(email: string, discord_id: string, server_id: string, timestamp: string) {
    this.email = email;
    this.discord_id = discord_id;
    this.server_id = server_id;
    this.timestamp = timestamp;
  }
}

export interface ServerPreferences {
  domain: string;
  prefix: string;
  cmd_channel: string | null;
  role_id: string | null;
  server_id: string;
}
