const nodemailer = require('nodemailer');

function send_mail(toMail, code){
  let fromMail = 'praetorian.discord@gmail.com';
  let subject  = 'Verification Email';

  const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
          user: '',
          pass: ''
      }
  });


  let mailOptions = {
      from: fromMail,
      to: toMail,
      subject: subject,
      text: code
  };


  transporter.sendMail(mailOptions, (error, response) => {
      if (error) {
          console.log(error);
      }
      console.log(response)
  });
}
