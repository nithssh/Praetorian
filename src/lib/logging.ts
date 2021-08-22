import * as fs from 'fs'

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

  async log(message: string, level: LogLevel = LogLevel.Log, logToConsole: boolean = false): Promise<void | NodeJS.ErrnoException> {
    return new Promise((resolve, reject) => {
      fs.appendFile(this.file, `[${this.date.toISOString()}] [${LogLevel[level]}] [*module* or *namespace*] ${message}\n`, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
      if (level == LogLevel.Error && logToConsole) {
        console.error(`[${this.date.toISOString()}] [${LogLevel[level]}] [*module* or *namespace*] ${message}`);
      } else if (logToConsole) {
        console.log(`[${this.date.toISOString()}] [${LogLevel[level]}] [*module* or *namespace*] ${message}`)
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