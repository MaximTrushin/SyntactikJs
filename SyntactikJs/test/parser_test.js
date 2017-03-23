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
    });


    var domPrinter = new DomPrinter();
    var pair = parser.parseModule();
    console.log("\u001b[33m" + "\nDOM:" + "\u001b[0m");
    var dom = domPrinter.printModule(pair);
    console.log(dom);

    var recordedDomName = cwd + "/scenarios/recorded/" + name + ".dom";
    if (fs.existsSync(recordedDomName)) {
        var recordedDom = fs.readFileSync(cwd + "/scenarios/recorded/" + name + ".dom", "utf8").replace(/\r\n/g, "\n");
        console.log("\u001b[33m" + "Recorded DOM:" + "\u001b[0m");
        console.log(recordedDom);
        assert.equal(recordedDom, dom);
    }

    console.log("\u001b[33m" + "Errors:" + "\u001b[0m");
    console.log(errors.join("\n"));

    var recordedErrorName = cwd + "/scenarios/recorded/" + name + ".error";
    if (fs.existsSync(recordedErrorName)) {

        var recordedError = fs.readFileSync(cwd + "/scenarios/recorded/" + name + ".error", "utf8").replace(/\r\n/g, "\n");
        console.log("\u001b[33m" + "Recorded Errors:" + "\u001b[0m");
        console.log(recordedError);
        assert.equal(recordedError, errors.join("\n") + "\n");
    } else {
        assert.equal(errors.length, 0);
    }
    
};

function format() {
    var args = arguments;
    return args[0].replace(/{(\d+)}/g, function (match, number) {
        return typeof args[1][number] != 'undefined'
            ? args[1][number]
            : match
            ;
    });
};

test();
//testScenario("UnclosedDq");

console.log("\u001b[32m" + "all ok" + "\u001b[0m");
