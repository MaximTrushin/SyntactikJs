define(function (require, exports, module) {
    "use strict";
    /*eslint no-constant-condition: ["error", { "checkLoops": false }]*/

    var pairModule = require("./Pair");
    var Pair = pairModule.Pair;
    var DelimiterEnum = pairModule.DelimiterEnum;

    var Parser = function (input) {
        this.input = input;
        this.errorListeners = [];
        this.wsaStack = [];
        this.pairStack = [];
        this.lineState = null;
        this.indentSymbol = 0;
        this.indentMultiplicity = 0;
    };

    var ParserStateEnum = {
        Indent: 1, //New line started. Indent is checked to calculate the current pair.
        PairDelimiter: 2,
        Name: 4,
        Delimiter: 8,
        Value: 16,
        IndentMLS: 32 //Indent for multiline string
    };

    var LineParsingState = function () {
        return {
            indent: 0,
            indentBegin: 0,
            indentEnd: 0,
            inline: false,
            state: ParserStateEnum.Indent,
            chainingStarted: false,
            chainStart: null,
            reset: Reset
        };


        function Reset() {
            if (this.state !== ParserStateEnum.IndentMLS) this.state = ParserStateEnum.Indent;
            this.chainingStarted = false;
            this.chainStart = null;
            this.inline = false;
        }
    };

    (function () {
        this.parseModule = function () {
            this.resetState();

            while (this.input.next !== -1) {
                this.parseLine();
            }

            if (this.lineState.state === ParserStateEnum.IndentMLS) this.parseMlStringIndent();

        };

        this.parseLine = function () {
            this.lineState.reset();
            while (this.input.next !== -1) {
                switch (this.lineState.state) {
                    case ParserStateEnum.Indent:
                        this.parseIndent();
                        this.lineState.state = ParserStateEnum.Name;
                        break;
                    case ParserStateEnum.Name:
                        this.parseName();                        
                        break;
                }
            }
        };

        this.parseIndent = function () {

            if (this.wsaStack.Count > 0){ //Do not calculate indent for inline pair or wsa mode            
                this.input.consumeSpaces();
                return;
            }
            var indentSum = 0, begin = -1, end = -2;
            while (true) {
                if (this.input.next === 9 || this.input.next === 32) {
                    indentSum += this.input.next.chatCodeAt(0);
                    this.input.consume();
                    if (begin === -1) begin = this.input.index;
                    end = this.input.index;

                }
                else if (this.input.consumeNewLine() || this.input.consumeComments() || this.input.next === -1) {
                    begin = -1;
                    end = -2;
                    if (this.input.next === -1) break;
                }
                else break;                
            }

            this.processIndent(begin, end, indentSum);
        };

        this.parseName = function () {
            
            while (this.input.next !== -1) {
                if (this.input.next === 39) { // '
                    this.parseSQName();
                    this.lineState.state = ParserStateEnum.Delimiter;
                    break;
                } else if (this.input.next === 34) { // "
                    this.parseSQName();
                    this.lineState.state = ParserStateEnum.Delimiter;
                    break;
                } else if (this.input.next === 40 || this.input.next === 41 || this.input.next === 44) { // (  )  ,
                    this.Consume();
                    this.reportUnexpectedCharacter();
                } else if (this.input.next === 61 || this.input.next === 58){ // =  :
                    var p = new Pair();
                    p.name = "";
                    this.setInterval(p.nameInterval, this.input, this.input);

                    this.pairStack.peekBack().pair.block.push(p);

                    this.pairStack.push(
                        {
                            pair: p,
                            begin: this.lineState.indentBegin,
                            end: this.lineState.indentEnd,
                            indent: this.lineState.indent
                        }
                    );
                    this.lineState.inline = true;
                    this.lineState.state = ParserStateEnum.Delimiter;
                } if (this.input.consumeSpaces() || this.input.consumeComments()) {
                } else if (this.input.isNewLineCharacter()) {
                    if (this.wsaStack.length > 0) {
                        this.input.consumeNewLine();
                        this.consumeLeadingSpaces();
                    } else
                        break;
                } else {
                    this.parseOpenName();
                    this.lineState.state = ParserStateEnum.Delimiter;
                    break;
                }
            }
        };

        this.parseMlStringIndent = function () {

        };

        this.resetState = function () {
            this.input.reset();
            this.wsaStack = [];
            this.pairStack = [];
            var p = new Pair();
            p.name = "Module";
            p.delimiter = DelimiterEnum.C;
            this.pairStack.push(
                {
                    pair: p,
                    begin: -1,
                    end: -1,
                    indent: -1
                }
            );
            p.createBlock();

            this.indentMultiplicity = 0;
            this.lineState = new LineParsingState();

        };

        this.setInterval = function(interval, begin, end) {
            interval.begin.index = begin.index;
            interval.begin.line = begin.line;
            interval.begin.column = begin.column;
            interval.end.index = end.index;
            interval.end.line = end.line;
            interval.end.column = end.column;
        };

        this.createInterval = function (begin, end) {
            return {
                begin: {
                    index : begin.index,
                    line : begin.line,
                    column : begin.column
                },
                end: {
                    index : end.index,
                    line : end.line,
                    column : end.column
                }
            };
        };

        this.processIndent = function(begin, end, indentSum) {
            var indent = end - begin + 1;
            if (this.indentSymbol === 0 && indent > 0) //First indent defines indent standard for the whole file.
                this.indentSymbol = this.input.GetChar(begin);

            while (this.pairStack[this.pairStack.length-1].indent >= indent) this.pairStack.pop();

            if (this.pairStack[this.pairStack.length - 1].pair.blockIndent === -1) this.pairStack[this.pairStack.length - 1].pair.blockIndent = indent;
            else {
                if (this.pairStack[this.pairStack.length - 1].pair.blockIndent !== indent)
                    this.reportBlockIndentationMismatch(
                        {
                            begin: {
                                index: this.input.index - indent,
                                line: this.input.line,
                                column: 1
                            },
                            end: {
                                index: this.input.index,
                                line: this.input.line,
                                column: this.input.column
                            }
                        }
                    );
            }
            if (this.indentMultiplicity === 0) {
                if (indent > 0) {
                    this.indentMultiplicity = indent;
                }
            }

            this.checkIndentErrors(indent, indentSum);

            this.lineState.indent = indent;
            this.lineState.indentBegin = begin;
            this.lineState.indentEnd = end;


        };
        this.checkIndentErrors = function (indent, indentSum) {
            // Multiplicity of the indent symbols must be the same for the whole document
            if (this.indentMultiplicity > 0 && indent % this.indentMultiplicity > 0)
                this.reportInvalidIndentationMultiplicity(
                    {
                        begin: {
                            index: this.input.index - indent,
                            line: this.input.line,
                            column: 1
                        },
                        end: {
                            index: this.input.index,
                            line: this.input.line,
                            column: this.input.column
                        }
                    }

                   );


            //Indent must be increased exactly with number of symbols defined by indent multiplicity
            if (this.indentMultiplicity > 0 && indent > this.lineState.indent && indent !== this.lineState.indent + this.indentMultiplicity &&
                indent % this.indentMultiplicity === 0)
                this.reportInvalidIndentationSize(
                    {
                        begin: {
                            index: this.input.index - indent,
                            line: this.input.line,
                            column: 1
                        },
                        end: {
                            index: this.input.index,
                            line: this.input.line,
                            column: this.input.column
                        }
                    }
                );

            //Indent must consists of the either tab or space but both are not allowed.
            if ((indent > 0) && indentSum !== this.indentSymbol * indent)
                this.reportMixedIndentation(
                    {
                        begin: {
                            index: this.input.index - indent,
                            line: this.input.line,
                            column: 1
                        },
                        end: {
                            index: this.input.index,
                            line: this.input.line,
                            column: this.input.column
                        }
                    }
                );
        };
        this.consumeLeadingSpaces = function() {
            
            if (this.input.next === 9 || this.input.next === 32) {
                if (this.indentSymbol === 0) this.indentSymbol = this.input.next.charCodeAt(0);
            }
            else return;

            var indentSum = this.input.next.charCodeAt(0);
            var indent = 1;
            while (true) {
                this.input.consume();
                
                if (!this.input.isSpaceCharacter()) break;
                indent++;
                indentSum += c;
            }

            if (indentSum !== this.indentSymbol * indent) this.reportInvalidIndentation(
                {
                    begin: {
                        index: this.input.index - indent,
                        line: this.input.line,
                        column: 1
                    },
                    end: {
                        index: this.input.index,
                        line: this.input.line,
                        column: this.input.column
                    }
                }                
            );
            
        };
        this.parseOpenName = function() {

            var begin = {index: -1, line: 0, column: 0};
            var end = { index: -1, line: 0, column: 0 };
            while (this.input.next !== -1) {
                if (this.input.isEndOfOpenName()) {
                    break;
                }
                this.input.consume();

                if (!this.input.isSpaceCharacter()) {
                    if (begin.index === -1) begin = this.getLocation(this.input);
                    end = this.getLocation(this.input);
                }
            }
            var pair = new Pair();
            pair.name = this.input.getText(begin.index, end.index);
            pair.nameInterval = this.createInterval(begin, end);

            this.pairStack[this.pairStack.length - 1].pair.block.push(pair);

            this.pairStack.push( { pair : pair, indent : this.lineState.indent, begin : this.lineState.indentBegin, end : this.lineState.indentEnd });

            this.lineState.inline = true;
        };
        this.getLocation = function(input) {
            return {
                index: input.index,
                line: input.line,
                column: input.column
            };
        };
    }).call(Parser.prototype);

    exports.Parser = Parser;
});