'use strict';

require("amd-loader");

var InputStream = require("./InputStream").InputStream;
var input = new InputStream("el1");

var Parser = require("./Parser").Parser;
var parser = new Parser(input);
parser.parseModule();

Foobar.fromComponents = function (foo, bar) {
    var foobar = foo + bar;
    return new this(foobar);
};

var f = Foobar.fromComponents(1, 2);


var o = {
    name: "O",
    printName: PrintName
};

var a = [];
a.push(PrintName);
a[0].call(o);


console.log('Hello world');
var tests = require('./highlight_rules_test.js');
tests.test();

function Foobar(foobar) {
    this.foobar = foobar;
}



function PrintName() {
    console.log(this.name);
}