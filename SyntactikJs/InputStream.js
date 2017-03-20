define(function (require, exports, module) {
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
        this.next = this.length > 0 ? this.data[0] : -1;
    };

    (function () {
        this.consume = function () {
            if (this.index >= this.length) {
                throw "The input has reached the EOF.";
            }

            this.index++;
            this.next = this.index + 2 <= this.length ? this.data[this.index + 1] : -1;

            if (this.data[this.index] === 10) {
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
            this.next = this.length > 0 ? this.data[0] : -1;
        };

    }).call(InputStream.prototype);

    exports.InputStream = InputStream;

});