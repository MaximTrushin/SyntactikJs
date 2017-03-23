define(function (require, exports) {
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

            while (this.pairStack[this.pairStack.length - 1].indent >= 0) this.pairStack.pop();

            if (this.wsaStack.length > 0)
                this.reportSyntaxError(1, this.createInterval(this.input, this.input), "Closing parenthesis");

            return this.pairStack[this.pairStack.length - 1].pair;
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
                    case ParserStateEnum.Delimiter:
                        this.parseDelimiter();
                        break;
                    case ParserStateEnum.Value:
                        this.parseValue();
                        if (this.lineState.state !== ParserStateEnum.IndentMLS && this.lineState.state !== ParserStateEnum.PairDelimiter)
                            this.lineState.state = this.lineState.chainingStarted ? ParserStateEnum.Delimiter : ParserStateEnum.PairDelimiter;
                        break;
                    case ParserStateEnum.PairDelimiter:
                        this.parsePairDelimiter();
                        this.lineState.state = ParserStateEnum.Name;
                        break;
                    case ParserStateEnum.IndentMLS:
                        if (this.parseMlStringIndent()) {
                            if (!this.parseMlValue())
                                this.lineState.state = ParserStateEnum.Indent;
                        }
                        else {
                            this.lineState.state = ParserStateEnum.PairDelimiter;
                        }
                        break;
                }
                if (this.wsaStack.length === 0 && this.eol()) {
                    this.exitInlinePair();
                    break;
                }
            }
        };

        this.parseIndent = function () {

            if (this.wsaStack.length > 0){ //Do not calculate indent for inline pair or wsa mode            
                this.input.consumeSpaces();
                return;
            }
            var indentSum = 0, begin = -1, end = -2;
            while (true) {
                if (this.input.next === 9 || this.input.next === 32) {
                    indentSum += this.input.next;
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
                    this.parseDQName();
                    this.lineState.state = ParserStateEnum.Delimiter;
                    break;
                } else if (this.input.next === 40 || this.input.next === 41 || this.input.next === 44) { // (  )  ,
                    this.input.consume();
                    this.reportUnexpectedCharacter();
                } else if (this.input.next === 61 || this.input.next === 58){ // =  :
                    var p = new Pair();
                    p.name = "";
                    this.setInterval(p.nameInterval, this.input, this.input);

                    this.pairStack[this.pairStack.length - 1].pair.block.push(p);

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
                    break;
                } else if (this.input.consumeSpaces() || this.input.consumeComments()) {
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
            var begin = -1;
            var end = -2;
            var p = this.pairStack[this.pairStack.length - 1];
            var currentIndent = p.indent;
            var indentCounter = 0;

            var indentSum = 0;
            while (true) {
                if (this.input.next === 9 || this.input.next === 32) {
                    if (this.indentSymbol === 0) //First indent defines indent standard for the whole file.
                    {
                        this.indentSymbol = this.input.next;
                        this.indentMultiplicity = 1;
                    }
                    indentCounter++;
                    if (indentCounter <= currentIndent + this.indentMultiplicity) {
                        indentSum += this.input.next;
                        this.input.consume();
                        if (begin === -1) begin = this.input.index;
                        end = this.input.index;
                    }
                    else this.input.consume();

                }
                else if (this.input.next === -1) {
                    break;
                }
                else if (this.input.isNewLineCharacter()) {
                    this.input.consumeNewLine();
                    indentSum = 0;
                    indentCounter = 0;
                    begin = -1;
                    end = -2;
                }
                else {
                    break;
                }

            }
            var indent = end - begin + 1;

            if (this.input.next !== -1 && (indent > currentIndent)) {
                this.checkIndentErrors(indent, indentSum);
                return true;
            }


            var valueEnd = p.pair.valueInterval.end;
            var valueStart = this.getValueStart(p.pair);
            if (valueStart > 0) {
                this.assignValueToPair(p.pair.valueInterval.begin, p.pair.valueInterval.end, true);
                this.reportMLSSyntaxError(1, this.createInterval(valueEnd, valueEnd), valueStart);
            }
            else this.assignValueToPair(p.pair.valueInterval.begin, p.pair.valueInterval.end, false);

            this.processIndent(begin, end, indentSum);

            return false;
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
                this.indentSymbol = this.input.getChar(begin).charCodeAt(0);

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
                if (this.indentSymbol === 0) this.indentSymbol = this.input.next;
            }
            else return;

            var indentSum = this.input.next;
            var indent = 1;
            while (true) {
                this.input.consume();
                
                if (!this.input.isSpaceCharacter()) break;
                indent++;
                indentSum += this.input.next;
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
            var end = {index: -1, line: 0, column: 0};
            while (this.input.next !== -1) {
                if (this.input.isEndOfOpenName()) {
                    break;
                }
                this.input.consume();

                if (!this.input.isOnSpaceCharacter()) {
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

        this.parseDelimiter = function() {
            if (!this.consumeTillPairDelimiter()) {
                this.lineState.state = ParserStateEnum.PairDelimiter;
                return;
            }

            var delimiter = this.getDelimiter();
            var p = this.pairStack[this.pairStack.length - 1].pair;
            var newPair;

            if (delimiter === DelimiterEnum.E || delimiter === DelimiterEnum.EE || delimiter === DelimiterEnum.CE || delimiter === DelimiterEnum.None) //Delimiters followed by literal or chained pair
            {
                if (!this.lineState.chainingStarted) {
                    p.delimiter = delimiter;
                } else {
                    newPair = new Pair();
                    newPair.name = this.input.getText(p.valueInterval.begin.index, p.valueInterval.end.index);
                    newPair.nameInterval = p.valueInterval;
                    newPair.delimiter = delimiter;
                    p.objectValue = newPair;
                    p.value = null;
                    this.pairStack.push({
                        pair: newPair,
                        indent: this.lineState.indent,
                        begin: this.lineState.indentBegin,
                        end: this.lineState.indentEnd
                    });

                }
                this.lineState.inline = true;

                this.ensureDelimiterEnds();
            } else // Delimiters followed by block
            {
                if (!this.lineState.chainingStarted) {
                    p.delimiter = delimiter;
                    p.createBlock();

                }
                else {
                    newPair = new Pair();
                    newPair.name = this.input.getText(p.valueInterval.begin.index, p.valueInterval.end.index);
                    newPair.nameInterval = p.valueInterval;
                    newPair.delimiter = delimiter;
                    newPair.createBlock();
                    p.objectValue = newPair;
                    p.value = null;

                    this.pairStack.push({
                        pair: newPair,
                        indent: this.lineState.indent,
                        begin: this.lineState.indentBegin,
                        end: this.lineState.indentEnd
                    });
                }

                if (this.input.next === 40) { // (
                    this.input.consume();
                    this.wsaStack.push(p);
                    this.lineState.state = ParserStateEnum.Delimiter; //should start with check of closing parenthesis
                }
                else {
                    this.ensureDelimiterEnds();
                }
            }

            this.lineState.state = ParserStateEnum.Value;
        };

        this.consumeTillPairDelimiter = function() {
            
            while (this.input.next !== 58 /* : */ && this.input.next !== 61 /* = */) {
                if (this.input.next === -1) {
                    this.lineState.state = ParserStateEnum.PairDelimiter;
                    return false;
                }

                if (this.input.consumeSpaces()) {
                }
                else if (this.input.isNewLineCharacter()) {
                    if (this.wsaStack.length > 0) {
                        this.input.consumeNewLine();
                        this.consumeLeadingSpaces();
                    }
                    else {
                        this.lineState.state = ParserStateEnum.PairDelimiter;
                        return false;
                    }
                }
                else switch (this.input.next) {
                    case 41: // )
                        if (this.wsaStack.length > 0) {
                            this.lineState.state = ParserStateEnum.PairDelimiter;
                            return false;
                        }
                        this.input.consume();
                        this.reportUnexpectedCharacter();
                        break;
                    case 40: //()
                        this.input.consume();
                        this.reportUnexpectedCharacter();
                        break;
                    //case ',':
                    //case '\'':
                    //case '"':
                    default:
                        this.lineState.state = ParserStateEnum.PairDelimiter;
                        return false;
                }
            }
            return true;
        };
        this.getDelimiter = function() {
            var delimiter;
            if (this.input.next === 58) { // :
                this.input.consume();

                if (this.input.next === 58) { // :
                    this.input.consume();
                    if (this.input.next === 58) { // :
                        this.input.consume();
                        delimiter = DelimiterEnum.CCC;
                    }
                    else delimiter = DelimiterEnum.CC;
                }
                else {
                    if (this.input.next === 61) {  //  =
                        this.input.consume();
                        delimiter = DelimiterEnum.CE;
                    }
                    else delimiter = DelimiterEnum.C;
                }
            }
            else // =
            {
                this.input.consume();
                if (this.input.next === 61) { // = 
                    this.input.consume();
                    delimiter = DelimiterEnum.EE;
                }
                else if (this.input.next === 58) // : =:
                {
                    this.input.consume();
                    if (this.input.next === 58) // : =::
                    {
                        this.input.consume();
                        delimiter = DelimiterEnum.ECC;
                    }
                    else {
                        delimiter = DelimiterEnum.EC;
                    }
                }
                else {
                    delimiter = DelimiterEnum.E;
                }
            }
            return delimiter;            
            
        };
        this.ensureDelimiterEnds = function() {
            while (this.input.next === 58 || this.input.next === 61) { //  :    =
                this.input.consume();
                this.reportUnexpectedCharacter();
            }
        };
        this.parseValue = function() {
            var p = this.pairStack[this.pairStack.length - 1].pair;

            if (p.delimiter !== DelimiterEnum.E && p.delimiter !== DelimiterEnum.EE && p.delimiter !== DelimiterEnum.CE && p.delimiter !== DelimiterEnum.None)
            {
                //Block 
                return;
            }

            //Literal
            if (p.delimiter === DelimiterEnum.EE && this.wsaStack.length === 0)
            {
                this.parseFreeOpenString();
            }
            else {
                this.parseLiteralValue();
                if (this.lineState.state !== ParserStateEnum.IndentMLS) {
                    if (p.delimiter === DelimiterEnum.CE)
                        this.startChaining();
                    if (this.lineState.chainingStarted && p.delimiter !== DelimiterEnum.CE)
                        this.lineState.state = ParserStateEnum.PairDelimiter;
                }
            }
        };
        this.parseFreeOpenString = function() {
            this.input.consumeSpaces();
            var begin = { index: -1, line: 0, column: 0 };
            var end = {index: -1, line: 0, column: 0};
            while (this.input.next !== -1) {
                if (this.input.isNewLineCharacter()) {
                    if (this.wsaStack.length < 1) {
                        this.lineState.state = ParserStateEnum.IndentMLS;
                        this.assignMappedValueToPair(begin, end);
                        return;
                    }
                    break;
                }
                this.input.consume();

                if (!this.input.isOnSpaceCharacter()) //Ignoring leading and trailing spaces
                {
                    if (begin.index === -1) begin = this.getLocation(this.input);
                    end = this.getLocation(this.input);
                }
            }

            this.assignValueToPair(begin, end, false);
            
        };
        this.assignValueToPair = function(begin, end, missingQuote) {
            var pair = this.pairStack[this.pairStack.length - 1].pair;

            pair.valueInterval.begin = begin;
            pair.valueInterval.end = end;

            if (begin.index === -1) {
                pair.value = "";
                return;
            }

            if (pair.valueQuotesType === 1 || pair.valueQuotesType === 2)
            {
                if (!missingQuote) {
                    pair.value = this.getValueFromValueInterval(pair, begin.index + 1, end.index - 1,
                        this.lineState.indent + 1);
                }
                else {
                    pair.value = this.getValueFromValueInterval(pair, begin.index + 1, end.index,
                        this.lineState.indent + 1);
                }
            }
            else
            {
                pair.value = this.getValueFromValueInterval(pair, begin.index, end.index,
                    this.lineState.indent + 1);
            }
        };
        this.getValueFromValueInterval = function (pair, begin, end, valueIndent) {
            function trimEndOfOpenStringLine(line, ignoreTrailing) {
                if (ignoreTrailing)
                    return line.replace(/\s*$/, ""); //ignoring trailing whitespace for open strings
                return line;
            };
            var sb = "";

            var folded = pair.delimiter === DelimiterEnum.E && pair.valueQuotesType === 0 || pair.valueQuotesType === 1;

            //Splitting text. Getting array of text lines
            var lines = this.input.getText(begin, end).split(/\r?\n/g);

            var first = true;
            var firstEmptyLine = true; //If true then previous line was not empty therefor newline shouldn't be added

            for (var item of lines) {
                var line = trimEndOfOpenStringLine(item, pair.valueQuotesType === 0);

                if (first) { sb += line; first = false; continue; } //adding first line without appending new line symbol

                if (line.length <= valueIndent) //this is just empty line
                {
                    if (folded)//Folded string
                    {
                        if (firstEmptyLine) {
                            firstEmptyLine = false;
                            continue; //Ignore first empty line for folded string
                        }
                    }
                    sb += "\n"; continue;
                }

                line = line.substring(valueIndent);

                if (folded && firstEmptyLine) sb += " ";
                if (!folded || !firstEmptyLine) sb += "\n";
                firstEmptyLine = true; //reseting the flag for folded string logic
                sb +=line;//Removing indents                    
            }

            return sb;            
        };
        this.parseLiteralValue = function() {
            this.input.consumeSpaces();
            this.input.consumeComments();
            
            if (this.input.next === 39) { // '
                this.parseSQValue();
            } else if (this.input.next === 34) { // "
                this.parseDQValue();
            }
            else
                this.parseOpenString();
            
        };
        this.parseSQValue = function() {
            this.pairStack[this.pairStack.length - 1].pair.valueQuotesType = 1;
            this.input.consume(); // Consume starting '
            var begin = this.getLocation(this.input);

            while (true) {
                if (this.input.next === 39) { // '
                    this.input.consume();
                    this.assignValueToPair(begin, this.getLocation(this.input), false);
                    break;
                }

                if (this.input.next === 92) { // \
                    this.input.consume();
                }

                if (this.input.isNewLineCharacter()) {
                    if (this.wsaStack.length < 1) {
                        this.assignMappedValueToPair(begin, this.getLocation(this.input));
                        this.lineState.state = ParserStateEnum.IndentMLS;
                        break;
                    }

                    this.reportSyntaxError(1, this.createInterval(this.input, this.input), "Single quote");
                    this.assignValueToPair(begin, this.getLocation(this.input), true);
                    break;
                }

                if (this.input.next === -1) {
                    this.reportSyntaxError(1, this.createInterval(this.input, this.input), "Single quote");
                    this.assignValueToPair(begin, this.getLocation(this.input), true);
                    break;
                }

                this.input.consume();
            }
            
        };
        this.reportSyntaxError = function () {
            for (var listener of this.errorListeners) {
                listener.apply(this, arguments);
            }
        };
        this.assignMappedValueToPair = function(begin, end) {
            var pair = this.pairStack[this.pairStack.length - 1].pair;
            pair.valueInterval.begin = begin;
            pair.valueInterval.end = end;
        };
        this.parseDQValue = function() {
            this.pairStack[this.pairStack.length - 1].pair.valueQuotesType = 2;
            this.input.consume(); // Consume starting '
            var begin = this.getLocation(this.input);

            while (true) {
                if (this.input.next === 34) { // "
                    this.input.consume();
                    this.assignValueToPair(begin, this.getLocation(this.input), false);
                    break;
                }

                if (this.input.isNewLineCharacter()) {
                    if (this.wsaStack.length < 1) {
                        this.assignMappedValueToPair(begin, this.getLocation(this.input));
                        this.lineState.state = ParserStateEnum.IndentMLS;
                        break;
                    }

                    this.reportSyntaxError(1, this.createInterval(this.input, this.input), "Double quote");
                    this.assignValueToPair(begin, this.getLocation(this.input), true);
                    break;
                }

                if (this.input.next === -1) {
                    this.reportSyntaxError(1, this.createInterval(this.input, this.input), "Double quote");
                    this.assignValueToPair(begin, this.getLocation(this.input), true);
                    break;
                }

                this.input.consume();
            }
            
        };
        this.parseOpenString = function() {
            var begin = { index: -1, line: 0, column: 0 };
            var end = { index: -1, line: 0, column: 0 };
            while (true) {
                if (this.input.isEndOfOpenString() || this.input.next === -1) {
                    this.assignValueToPair(begin, end, false);
                    break;
                }

                if (this.input.isNewLineCharacter()) {

                    if (this.wsaStack.length < 1) {
                        this.lineState.state = ParserStateEnum.IndentMLS;
                    }
                    else this.assignValueToPair(begin, end, false);
                    break;
                }
                this.input.consume();

                if (!this.input.isOnSpaceCharacter()) {
                    if (begin.index === -1) begin = this.getLocation(this.input);
                    end = this.getLocation(this.input);
                }

            }
            this.assignMappedValueToPair(begin, end);
        };
        this.parsePairDelimiter = function() {
            var firstComma = true;
            while (this.input.next !== -1) {
                if (this.input.consumeSpaces()) { }
                else if (this.input.consumeComments()) { }
                else if (this.input.next === 40) {  // (
                    this.input.consume();
                    this.reportUnexpectedCharacter();
                }
                else {
                    var p;
                    if (this.input.next === 41) {  // )
                        if (this.wsaStack.length > 0) {
                            p = this.wsaStack.pop();
                            this.lineState.chainingStarted = false;
                            firstComma = true;
                            while (this.pairStack.length > 0) {
                                var p1 = this.pairStack.pop().pair;
                                if (p1 === p) break;
                            }
                            this.input.consume();
                        }
                        else {
                            this.input.consume();
                            this.reportUnexpectedCharacter();
                        }

                    }
                    else if (this.input.next === 44) {  // ,
                        //There can be only 1 comma between pairs.
                        if (firstComma && this.lineState.inline) {
                            this.exitPair();
                            firstComma = false;
                            this.input.consume();
                        }
                        else {
                            this.reportUnexpectedCharacter();
                            this.input.consume();
                        }
                    } else if (this.input.isNewLineCharacter()) {
                        if (this.wsaStack.length > 0) {
                            this.input.consumeNewLine();
                            this.consumeLeadingSpaces();
                        } else {
                            break;
                        }
                    }
                    else // new pair is starting
                    {
                        p = this.pairStack[this.pairStack.length - 1].pair;
                        if (p.delimiter === DelimiterEnum.E || p.delimiter === DelimiterEnum.EE || p.delimiter === DelimiterEnum.CE || p.delimiter === DelimiterEnum.None)
                        {
                            this.exitPair();
                            p = this.pairStack[this.pairStack.length - 1].pair;

                            if (this.lineState.inline && p.block !== null && p.block.length > 0 && firstComma)
                            {
                                this.reportSyntaxError(1, this.createInterval(this.input, this.input), this.wsaStack.length > 0 ? "Comma or closing parenthesis" : "Comma");
                            }
                        }
                        else
                        {
                            p = this.pairStack[this.pairStack.length - 1].pair;

                            if (this.lineState.inline && p.block !== null && p.block.length > 0 && firstComma)
                            {
                                this.reportSyntaxError(1, this.createInterval(this.input, this.input), this.wsaStack.length > 0 ? "Comma or closing parenthesis" : "Comma");
                                this.exitPair();
                            }
                        }
                        break;
                    }
                }
            }
        };
        this.exitPair = function() {
            if (this.lineState.chainingStarted) {
                while (this.pairStack[this.pairStack.length - 1].pair !== this.lineState.chainStart) this.pairStack.pop();
                this.lineState.chainingStarted = false;
                this.lineState.chainStart = null;
            }

            if (this.pairStack[this.pairStack.length - 1].indent === this.lineState.indent)
                this.pairStack.pop();
            
        };
        this.reportUnexpectedCharacter = function() {
            this.reportSyntaxError(0, this.createInterval(this.input, this.input), this.input.getChar(this.input.index));
        };
        this.eol = function() {
            if (this.input.next === -1) return true;
            if (this.input.next === 13) {
                this.input.consume();
            }
            if (this.input.next !== 10) return false;
            this.input.consume();
            return true;
        };
        this.exitInlinePair = function() {
            if (this.lineState.state === ParserStateEnum.IndentMLS) return;

            while (this.pairStack.length > 1) {
                var pi = this.pairStack[this.pairStack.length - 1];

                if (pi.indent < this.lineState.indent) return;

                if (pi.pair.delimiter === DelimiterEnum.E || pi.pair.delimiter === DelimiterEnum.EE || pi.pair.delimiter === DelimiterEnum.CE || pi.pair.delimiter === DelimiterEnum.None)
                {
                    this.pairStack.pop();
                }
                else
                {
                    if (pi.pair.block.length > 0) this.pairStack.pop();
                    else return;
                }
            }
        };
        this.parseMlValue = function() {
            var p = this.pairStack[this.pairStack.length - 1].pair;
            var valueStart = this.getValueStart(p);

            while (true) {
                if (this.input.next === valueStart) { //Quoted ML string ended
                    this.input.consume();
                    p.valueInterval.end = this.getLocation(this.input);
                    this.assignValueToPair(p.valueInterval.begin, p.valueInterval.end, false);
                    this.ensureNothingElseBeforeEol();
                    return false;
                }

                if (this.input.next === 92 /* \ */ && valueStart === 39  /* ' */) //escape symbol in SQS  
                {
                    this.input.consume();
                }

                if (this.input.isNewLineCharacter()) {
                    p.valueInterval.end = this.getLocation(this.input);
                    return true;
                }

                if (this.input.next === -1) {
                    p.valueInterval.end = this.getLocation(this.input);
                    if (valueStart > 0) {
                        this.reportMLSSyntaxError(1, this.createInterval(this.input, this.input), valueStart);
                        this.assignValueToPair(p.valueInterval.begin, p.valueInterval.end, true);
                    }
                    else this.assignValueToPair(p.valueInterval.begin, p.valueInterval.end, false);
                    return false;
                }
                this.input.consume();
            }
        };
        this.getValueStart = function(pair) {
            if (pair.valueQuotesType === 2) return 34;
            if (pair.valueQuotesType === 1) return 39;
            return -2;
        };
        this.reportMLSSyntaxError = function (code, interval, start) {
            var quoteName = start === 34/* " */ ? "Double quote" : "Single quote";
            this.reportSyntaxError(code, interval, quoteName);
        };
        this.ensureNothingElseBeforeEol = function() {
            while (this.input.next !== -1 && !this.input.isNewLineCharacter()) {
                if (this.input.consumeSpaces() || this.input.consumeComments()) { }
                else {
                    this.input.consume();
                    this.reportUnexpectedCharacter();
                }
            }
        };
        this.reportMixedIndentation = function(interval) {
            this.reportSyntaxError(5, interval);
        };
        this.startChaining = function() {
            if (!this.lineState.chainingStarted) {
                this.lineState.chainingStarted = true;
                this.lineState.chainStart = this.pairStack[this.pairStack.length - 1].pair;
            }
        };
        this.parseSQName = function() {
            this.input.consume(); // Consume starting '
            var begin = this.getLocation(this.input);

            while (true) {
                if (this.input.next === 39) { // '
                    this.input.consume();
                    break;
                }

                if (this.input.isNewLineCharacter() || this.input.next === -1) {
                    this.reportSyntaxError(1, this.createInterval(this.input, this.input), "Single quote");
                    break;
                }

                this.input.consume();
            }
            var name = this.input.getChar(this.input.index).charCodeAt(0) === 39 /* ' */ ? this.input.getText(begin.index + 1, this.input.index - 1): this.input.getText(begin.index + 1, this.input.index);
            var pair = new Pair();
            pair.name = name;
            pair.nameInterval = this.createInterval(begin, this.input);
            pair.nameQuotesType = 1;
            this.pairStack[this.pairStack.length - 1].pair.block.push(pair);
            this.pairStack.push({ pair: pair, indent: this.lineState.indent, begin: this.lineState.indentBegin, end: this.lineState.indentEnd });
            this.lineState.inline = true;
        };
        this.reportBlockIndentationMismatch = function(interval) {
            this.reportSyntaxError(3, interval);
        };
        this.reportInvalidIndentationSize = function(interval) {
            this.reportSyntaxError(6, interval);
        };
        this.reportInvalidIndentationMultiplicity = function(interval) {
            this.reportSyntaxError(4, interval);
        };
        this.reportInvalidIndentation = function(interval) {
            this.reportSyntaxError(2, interval);
        };
        this.parseDQName = function() {
            this.input.consume(); // Consume starting "
            var begin = this.getLocation(this.input);

            while (true) {
                if (this.input.next === 34) { // "
                    this.input.consume();
                    break;
                }

                if (this.input.isNewLineCharacter() || this.input.next === -1) {
                    this.reportSyntaxError(1, this.createInterval(this.input, this.input), "Double quote");
                    break;
                }

                this.input.consume();
            }
            var name = this.input.getChar(this.input.index).charCodeAt(0) === 34 /* " */ ? this.input.getText(begin.index + 1, this.input.index - 1) : this.input.getText(begin.index + 1, this.input.index);
            var pair = new Pair();
            pair.name = name;
            pair.nameInterval = this.createInterval(begin, this.input);
            pair.nameQuotesType = 2;
            this.pairStack[this.pairStack.length - 1].pair.block.push(pair);
            this.pairStack.push({ pair: pair, indent: this.lineState.indent, begin: this.lineState.indentBegin, end: this.lineState.indentEnd });
            this.lineState.inline = true;
        };
    }).call(Parser.prototype);

    var Errors = [
        "Unexpected character(s) `{0}`.", // 0
        "{0} is expected.", // 1
        "Invalid indentation.", //2
        "Block indent mismatch.",// 3
        "Invalid indent multiplicity.",// 4
        "Mixed indentation.", //5
        "Invalid indentation size."// 6
    ];

    exports.Parser = Parser;
    exports.Errors = Errors;
});