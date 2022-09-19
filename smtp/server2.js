/* a simple SMTP server in NodeJS that listens for inbound emails on port 25 and saves the emails into a local array */

var net = require("net");
var fs = require("fs");
var server = net.createServer(function (socket) {
  socket.setTimeout(3600000);
  socket.on("data", function (data) {
    var i, lines, line, email, from, to, subject, headers, body;
    // parse the email into lines
    lines = data.toString().trim().split("\r\n");
    // the first line should be the email's from field
    from = lines[0].substr(6);
    // the second line should be the email's to field
    to = lines[1].substr(4);
    // the third line should be the email's subject field
    subject = lines[2].substr(9);
    // the email's headers are everything up to the first blank line
    headers = lines.slice(3, lines.indexOf(""));
    // the email's body is everything that follows the first blank line
    body = lines.slice(lines.indexOf("") + 1);
    // create a simple email object to return
    email = {
      from: from,
      to: to,
      subject: subject,
      headers: headers,
      body: body,
    };
    // return the email to the socket
    socket.write("200 OK\r\n");
    socket.end();
    // save the email to a local array
    console.log(email);
    // save the email to a local file
    fs.appendFile("emails.txt", JSON.stringify(email), function (err) {
      if (err) throw err;
      console.log("Email saved!");
    });
  });
  socket.on("end", function () {
    socket.end();
  });
});
server.listen(25);
