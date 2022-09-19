/* a simple DNS server in NodeJS that listens for connections on port 53 and gives an A name for example.com and an MX record for example.com */
var dns = require("native-dns"),
  server = dns.createServer();

server.on("request", function (request, response) {
  console.log(request);

  var domain = request.question[0].name;
  var type = request.question[0].type;

  if (type == dns.consts.NAME_TO_QTYPE.A && domain == "example.com") {
    response.answer.push(
      dns.A({
        name: domain,
        address: "127.0.0.1",
        ttl: 600,
      })
    );
  } else if (type == dns.consts.NAME_TO_QTYPE.MX && domain == "example.com") {
    response.answer.push(
      dns.MX({
        name: domain,
        exchange: "mail." + domain,
        preference: 10,
        ttl: 600,
      })
    );
  }

  response.send();
});

server.on("error", function (err, buff, req, res) {
  console.log(err.stack);
});

server.serve(53);
