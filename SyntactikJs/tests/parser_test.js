require("amd-loader");

var fs = require("fs");
var path = require("path");
var cwd = __dirname + "/";

var InputStream = require("../InputStream").InputStream;
var DomPrinter = require("../DomPrinter").DomPrinter;
var Parser = require("../Parser").Parser;




function test() {
    var tests = fs.readdirSync(cwd + "/scenarios/").filter(function (fileName) { return fileName.match(/(.*).smx/) });
    tests.forEach(function (item) { testScenario(item.match(/(.*).smx/)[1])});

};

function testScenario(name) {
    console.log("Testing scenario " + name + "\n");
    
    var code = fs.readFileSync(cwd + "/scenarios/" + name + ".smx", "utf8");
    console.log("Code:");
    console.log(code);
    var input = new InputStream(code); 
    var parser = new Parser(input);
    var domPrinter = new DomPrinter();
    var pair = parser.parseModule();
    console.log("DOM:");
    console.log(domPrinter.printModule(pair));
};

module.exports = {
    test: test
}

test();
