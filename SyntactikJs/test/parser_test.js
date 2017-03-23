require("amd-loader");

var fs = require("fs");
var path = require("path");
var cwd = __dirname + "/";

var InputStream = require("../InputStream").InputStream;
var DomPrinter = require("../DomPrinter").DomPrinter;
var Parser = require("../Parser").Parser;

var QUnit = require("qunitjs");


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

QUnit.test("a test", function (assert) {

    function square(x) {
        return x * x;
    }

    var result = square(2);

    assert.equal(result, 5, "square(2) equals 4");
});
QUnit.start();


test();
