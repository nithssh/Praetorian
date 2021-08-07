import { createTransport } from 'nodemailer';

export function sendMail(toMail : string, code: number | string): void {
  let fromMail = require("../secrets").mailer.id;
  let subject = "Verification Email";

  const transporter = createTransport({
    service: "gmail",
    auth: {
      user: fromMail,
      pass: require("../secrets").mailer.pass,
    },
  });

  let mailOptions = {
    from: fromMail,
    to: toMail,
    subject: subject,
    text: `Verification code: ${code}\nUse the command "code" in the server's verificaiton channel to verify yourself.`, // Improve the message body???
  };

  transporter.sendMail(mailOptions, (error, response) => {
    if (error) {
      console.log(error.message);
    }
  });
}
