import * as fs from 'fs'
import { ServerPreferences } from './datamodels';

export class Logger {
  file!: number;
  date: Date;
  constructor() {
    this.date = new Date();
    // change the file to be day segregated
    fs.open("./logs/latest.log", 'a+', (err, fd) => {
      if (err) {
        if (err.code = "ENOENT") {
          fs.mkdir("./logs", () => {
            fs.open("./logs/latest.log", 'a+', (errNew, fd) => {
              if (!errNew) {
                this.file = fd;
              } else {
                console.error(errNew.message);
                process.exit(2);
              }
            });
          });
        }
      } else {
        this.file = fd;
      }
    });
  }

  async log(message: string, level: LogLevel = LogLevel.Log, logToConsole: boolean = false, sp: ServerPreferences | undefined = undefined): Promise<void | NodeJS.ErrnoException> {
    return new Promise((resolve, reject) => {
      let logMessage;
      if (sp) {
        logMessage = `[${this.date.toISOString()}] [${LogLevel[level]}] [${sp.server_id}] ${message}`;
      } else {
        logMessage = `[${this.date.toISOString()}] [${LogLevel[level]}] ${message}`;
      }
      fs.appendFile(this.file, `${logMessage}\n`, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
      if (level == LogLevel.Error && logToConsole) {
        console.error(logMessage);
      } else if (logToConsole) {
        console.log(logMessage);
      }
    });
  }

  exitSync() {
    fs.closeSync(this.file);
  }
}

export enum LogLevel {
  Error,
  Warning,
  Log,
  Info,
}