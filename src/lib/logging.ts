import * as fsp from 'fs/promises';
import { ServerPreferences } from './datamodels';

export class Logger {
  private _lastFileName: string | undefined;
  private get fileName(): string {
    let d = new Date();
    let newFileName = `log-${d.getDate()}-${d.getMonth()}-${d.getFullYear()}.log`
    if (!this._lastFileName || this._lastFileName != newFileName) {
      this._lastFileName = newFileName; // if date changed or is uninitialized
    }
    return this._lastFileName;
  }

  async log(message: string, level: LogLevel = LogLevel.Log, logToConsole: boolean = false, sp: ServerPreferences | undefined = undefined) {
    let path = `./logs/${this.fileName}`;
    let logMessage: string;
    if (sp) {
      logMessage = `[${Date()}] [${LogLevel[level]}] [${sp.server_id}]: ${message}\n`;
    } else {
      logMessage = `[${Date()}] [${LogLevel[level]}]: ${message}\n`;
    }

    // write to file
    try {
      await fsp.access(path);
    } catch {
      await fsp.mkdir('./logs');
    }
    fsp.appendFile(path, logMessage).catch(err => console.error(err));

    // print to console if needed
    if (level == LogLevel.Error && logToConsole) {
      console.error(logMessage);
    } else if (logToConsole) {
      console.log(logMessage);
    }
  };
}

export enum LogLevel {
  Error,
  Warning,
  Log,
  Info,
}