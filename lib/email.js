const nodemailer = require("nodemailer");

let fromMail = "";
let toMail = "";

let subject = "";
let text = "";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "",
    pass: "",
  },
});

let mailOptions = {
  from: fromMail,
  to: toMail,
  subject: subject,
  text: text,
};

transporter.sendMail(mailOptions, (error, response) => {
  if (error) {
    console.log(error);
  }
  console.log(response);
});
