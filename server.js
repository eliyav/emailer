const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const fs = require("fs");
require("dotenv").config();

const OAuth2 = google.auth.OAuth2;

const createTransporter = async () => {
  const oauth2Client = new OAuth2(
    process.env.OAUTH_CLIENT_ID,
    process.env.OAUTH_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.OAUTH_REFRESH_TOKEN,
  });

  const accessToken = await new Promise((resolve, reject) => {
    oauth2Client.getAccessToken((err, token) => {
      if (err) {
        reject("Failed to create access token :( " + err);
      }
      resolve(token);
    });
  });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.SENDER_EMAIL,
      accessToken,
      clientId: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      refreshToken: process.env.OAUTH_REFRESH_TOKEN,
    },
  });

  // 4
  return transporter;
};

const Storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, "./attachments");
  },
  filename: function (req, file, callback) {
    callback(null, `${file.fieldname}_${Date.now()}_${file.originalname}`);
  },
});
const attachmentUpload = multer({
  storage: Storage,
}).single("attachment");

const app = express();
const PORT = 3000;
app.use(express.static("src"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  res.sendFile("/index.html");
});

app.post("/send_email", (req, res) => {
  attachmentUpload(req, res, async function (error) {
    if (error) {
      return res.send("Error uploading file");
    } else {
      const recipient = req.body.email;
      const mailSubject = req.body.subject;
      const mailBody = req.body.message;
      const attachmentPath = req.file?.path;

      let mailOptions = {
        from: process.env.SENDER_EMAIL,
        to: recipient,
        subject: mailSubject,
        text: mailBody,
        attachments: [
          {
            path: attachmentPath,
          },
        ],
      };

      try {
        // Get response from the createTransport
        let emailTransporter = await createTransporter();

        // Send email
        emailTransporter.sendMail(mailOptions, function (error, info) {
          if (error) {
            // failed block
            console.log(error);
          } else {
            // Success block
            console.log("Email sent: " + info.response);
            fs.unlink(attachmentPath, function (err) {
              if (err) {
                return res.end(err);
              } else {
                console.log(attachmentPath + " has been deleted");
                return res.redirect("/success.html");
              }
            });
          }
        });
      } catch (error) {
        return console.log(error);
      }
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
