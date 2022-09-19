var net = require("net");
const fs = require("fs");
const path = require("path");
var filename = path.join("./", "emails.json");
var emailArray = [];

var server = net.createServer(function (socket) {
  socket.on("error", function (err) {
    console.log(err);
  });

  socket.on("data", function (rawData) {
    //console.log(data);
    //console.log(data.toString('utf-8'));
    const data = rawData.toString("utf-8");
    if (data.substring(0, 3) == "220") {
      socket.write("HELO server.com\r\n");
    } else if (data.substring(0, 3) == "250") {
      socket.write("MAIL FROM: <test@test.com>\r\n");
    } else if (data.substring(0, 3) == "250") {
      socket.write("RCPT TO: <test@test.com>\r\n");
    } else if (data.substring(0, 3) == "250") {
      socket.write("DATA\r\n");
    } else if (data.substring(0, 4) == "354 ") {
      // extract email into a separate variable
      var email = data;
      //console.log(email);

      // create and add the 'Received' header
      var received =
        "Received: from " +
        socket.remoteAddress +
        " (" +
        socket.remoteFamily +
        ") by localhost (" +
        socket.localFamily +
        ") with SMTP id " +
        Date.now() +
        ";\r\n";
      email = received + email;

      // remove the '.' (end of message)
      email = email.substring(0, email.length - 2);

      // add the newline character to the end of the email
      email = email + "\r\n";

      // add '.' to the end of the email
      email = email + ".\r\n";

      // add the email to the array
      emailArray.push(email);
      //console.log(email);

      // save the email to the JSON file
      fs.writeFile(filename, JSON.stringify(emailArray), (err) => {
        if (err) throw err;
        console.log("The file has been saved!");
      });

      // close the connection
      socket.write("QUIT\r\n");
    } else {
      socket.write("QUIT\r\n");
    }
  });
});

server.listen(2525);
