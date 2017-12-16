# SyntactikJs
This project is an experiment created to prove that it is possible to convert [Syntactik parser](https://github.com/syntactik/Syntactik/blob/master/Syntactik/Parser.cs)
to another language (in this case JavaScript) in a matter of days by just converting language instructions one to one. Like, for example, 
converting if statement in C# into if statement in JavaScript, etc.

Only the class Parser and all required classes are converted. Visitors, DOM classes, and compiler pipeline has not been converted.

The parser implementation doesn't have any dependencies and can be implemented in most languages by converting language instructions one to one. The whole compiler can be converted in the same way. Compiler pipeline depends on the [visitor patern](https://en.wikipedia.org/wiki/Visitor_pattern).
