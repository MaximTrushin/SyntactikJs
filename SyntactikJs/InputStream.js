define(function (require, exports) {
    "use strict";

    /**
     * This class takes a string, and creates an input for the SyntactikParser.
     * @class InputStream
     **/

    /**
     * Constructs instance of InputStream that is used as input by SyntactikParser.
     * @param {string} input The string representing the parser's input.
     *
     * @constructor
     **/
    var InputStream = function (input) {
        this.data = input;
        this.length = this.data.length;
        this.line = 1;
        this.column = 0;
        this.index = -1;
        this.next = this.length > 0 ? this.data.charCodeAt(0) : -1;
    };

    (function () {
        this.consume = function () {
            if (this.index >= this.length) {
                throw "The input has reached the EOF.";
            }

            this.index++;
            this.next = this.index + 2 <= this.length ? this.data.charCodeAt(this.index + 1) : -1;

            if (this.data[this.index] === "\n") {
                this.line = this.line + 1;
                this.column = 0;
            } else {
                this.column++;
            }
        };

        /**
            * Returns character from the stream without consuming it.
            * @param   {number}    i    if i = 0 then result is undefined.
            * if i = -1 then the function returns the previously read character. 
            * If i = -2 then the function returns the character prior to the previously read character, etc.
            * If i = 1 then the function returns the current character which is the next character to be consumed, etc.
            * @return  {string} Returns character.
            **/
        this.la = function (i) {
            if (i > 0) {
                var j = this.index + i;
                return j >= this.length ? -1 : this.data[j];
            }

            if (i === 0) {
                return 0;
            }

            i++;

            if (this.index + i < 0) {
                return -1;
            }
            i += this.index;
            return i >= this.length ? -1 : this.data[i];
        };
        
        this.getText = function (begin, end) {
            return this.data.slice(begin, end + 1);
        };
        
        this.getChar = function (index) {
            return this.data[index];
        };

        this.reset = function () {
            this.index = -1;
            this.next = this.length > 0 ? this.data.charCodeAt(0) : -1;
        };

        this.consumeNewLine = function () {
            if (this.next === 13) this.consume();
            if (this.next === 10) { this.consume(); return true; }
            return false;
        };

        this.consumeSpaces = function () {
            if (!this.isSpaceCharacter()) return false;
            while (true) {
                this.consume();
                if (!this.isSpaceCharacter()) return true;
            }
        };

        this.consumeComments = function() {
            if (this.consumeSlComment()) return true;
            if (this.consumeMlComment()) return true;
            return false;
        };

        this.consumeSlComment = function () {
            if (this.next !== 39) return false;
            if (this.la(2) !== 39) return false;
            if (this.la(3) !== 39) return false;

            this.consume(); this.consume(); this.consume();
            while (!this.isNewLineCharacter() && this.next !== -1) {
                this.consume();
            }
            return true;
        };

        this.consumeMlComment = function () {
            if (this.next !== 34) return false;
            if (this.la(2) !== 34) return false;
            if (this.la(3) !== 34) return false;

            this.consume(); this.consume(); this.consume();
            while (!(this.next === 34 && this.la(2) === 34 && this.la(3) === 34) && this.next !== -1) {
                this.consume();
            }

            if (this.next === 34) {
                this.consume(); this.consume(); this.consume();
            }
            return true;
        };

        this.isNewLineCharacter = function () {
            if (this.next === 10) return true;
            if (this.next === 13) return true;
            return false;
        };

        this.isSpaceCharacter = function () {
            if (this.next === 9) return true;
            if (this.next === 32) return true;
            return false;
        };

        this.isEndOfOpenName = function () {
            if (this.next > 61) return false;
            return this.next === 61 /* = */ || this.next === 58 /* : */ || this.next === 13 /* \r */ || this.next === 10 /* \n */ || this.next === 44 /* , */
                || this.next === 39 /* ' */ || this.next === 34 /* " */ || this.next === 41 /* ) */ || this.next === 40 /* ( */;
        };

        this.isEndOfOpenString = function () {
            if (this.next > 61) return false;
            return this.next === 61 /* = */ || this.next === 58 /* : */ || this.next === 44 /* , */
                || this.next === 39 /* ' */ || this.next === 34 /* " */ || this.next === 41 /* ) */ || this.next === 40 /* ( */;
        };

    }).call(InputStream.prototype);

    exports.InputStream = InputStream;

});