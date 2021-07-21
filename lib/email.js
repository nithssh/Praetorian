const nodemailer = require("nodemailer");

function sendMail(toMail, code) {
  let fromMail = require("../secrets").mailer.id;
  let subject = "Verification Email";

  const transporter = nodemailer.createTransport({
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
    text: `Verification code: ${code.toString()}.
    Use the command !code <code> to verify this code.`, // TODO Improve the message body
  };

  transporter.sendMail(mailOptions, (error, response) => {
    if (error) {
      console.log(error);
    }
    console.log(response);
  });
}

module.exports = { sendMail };
