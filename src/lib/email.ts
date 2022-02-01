import { createTransport } from 'nodemailer';

/** Sends a verification email to the given email address
 * 
 * @returns resolves true or false based on whether mail was sent successfully.
 *          rejects undefined when login failed.
*/
export async function sendMail(toMail: string, code: number | string): Promise<boolean> {
  let fromMail = process.env.EMAIL_ID;
  let subject = "Verification Email";

  const transporter = createTransport({
    service: "gmail",
    auth: {
      user: fromMail,
      pass: process.env.EMAIL_PWD,
    },
  });

  let mailOptions = {
    from: fromMail,
    to: toMail,
    subject: subject,
    text: `Verification code: ${code}\nUse the command "code" in the server's verification channel to verify yourself.`, // Improve the message body???
  };

  return new Promise(function (resolve, reject) {
    transporter.sendMail(mailOptions, (error, response) => {
      if (error) {
        console.log(error.message);
        if (error.message.includes("Invalid login")) {
          console.error(`Configuration Error: .env file has invalid email credentials. Please check them before restarting the bot.`);
          reject();
        }
        resolve(false);
      }
      resolve(true);
    });
  });
}
