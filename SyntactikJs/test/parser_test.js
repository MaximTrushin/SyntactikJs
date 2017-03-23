require("amd-loader");

var fs = require("fs");
//var path = require("path");
var cwd = __dirname + "/";

var InputStream = require("../InputStream").InputStream;
var DomPrinter = require("../DomPrinter").DomPrinter;
var Parser = require("../Parser");
//var assert = require("assert");
var assert = require('chai').assert;



function test() {
    var tests = fs.readdirSync(cwd + "/scenarios/").filter(function (fileName) { return fileName.match(/(.*).smx/) });
    tests.forEach(function (item) { testScenario(item.match(/(.*).smx/)[1])});

};

function testScenario(name) {
    console.log("\u001b[36m" + "Testing scenario " + name + "\n" + "\u001b[0m");
    
    var code = fs.readFileSync(cwd + "/scenarios/" + name + ".smx", "utf8");
    console.log("\u001b[33m" + "Code:" + "\u001b[0m");
    console.log(code);
    var input = new InputStream(code); 
    var parser = new Parser.Parser(input);

    var errors = [];
    parser.errorListeners.push(function () {
        var args = arguments;
        errors.push(format(Parser.Errors[args[0]], Array.prototype.slice.call(args, 2)) + " (" + args[1].begin.line + ":" + args[1].begin.column
            + ")-(" + args[1].end.line + ":" + args[1].end.column + ")");

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
