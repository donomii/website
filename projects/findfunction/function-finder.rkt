#lang racket
;Search the current naemspace for functions that match your requirements
;See bottom of file for examples

  [require mzlib/string mzlib/defmacro]
  [require srfi/1]
  ;[require srfi/1 srfi/2 srfi/4 srfi/5 srfi/6 srfi/7 srfi/8 srfi/9 srfi/11 srfi/13 srfi/14 srfi/16 srfi/17 srfi/19 
  ;srfi/23 srfi/25 srfi/26 srfi/27 srfi/28 srfi/29 srfi/30 srfi/31 srfi/34 srfi/35
  ;srfi/38  srfi/39 srfi/40 srfi/41 srfi/42 srfi/43 srfi/45  srfi/54 srfi/57 srfi/59 srfi/60 srfi/61  srfi/63 srfi/64 srfi/66 srfi/67 srfi/69 srfi/71 srfi/74 srfi/78 srfi/86 srfi/87 srfi/98
  
  
  ;Scheme has issues with lexical scoping
  [define-macro [eval-in-this-context a-string] 
    `[eval-syntax  [datum->syntax [quote-syntax here]  [read-from-string ,a-string]]] ]
  
  ;Prevent scheme from accidentally formatting my hard drive by installing a security guard.
  [current-security-guard  
   [make-security-guard 
    [current-security-guard] 
    [lambda args 
      [unless [empty? [filter [λ [x] [or [equal? 'write x][equal? 'delete x][equal? 'execute x]]] 
                              [third args ]]] 
        [[raise "File access not allowed"]]]]
    [λ args [error "Network access not allowed"]]]]
  
  ;New in version 4:  Namespaces are now even more confusing than before!
  (define-namespace-anchor a)
  (define ns (namespace-anchor->namespace a))
  
  ;Get the value of a symbol from the current namespace
  [define get-function [lambda [function-name] [eval-in-this-context [symbol->string function-name]]]]
  
  ;Check the input and output against a given symbol
  [define [testfunc function-name input output test?] 
    [with-handlers [[[const #t] [const #f]]]
      [test? [apply  [get-function function-name] input] output]]]
  
  ;You can supply your own test function to handle difficult data structures
  [define [guess-with-test input output test]
    [display [format "Searching for function x so that ~a -> ~a" input output]][newline]
    [filter [lambda [x]
              [if [and [not [regexp-match "exception|peek|read|exit|sleep|print|hashset|make-proj-contract|write|guess|display" [symbol->string x]]]
                       [begin 
                         ;If it starts crashing, you will need to uncomment this
                         ;[displayln x]
                         ;[with-handlers [[[const #t] [const #f]]][displayln [apply  [get-function x] input] output]]
                              
                              [testfunc x input output test]]]
                  x
                  #f
                  ]]
            (eval '(namespace-mapped-symbols) ns)]]   
  
  ;Supply a list of inputs and an output, guess will return any functions that match
  [define [guess input output]
    [guess-with-test input output equal?]]
  
  
  ;Supply a list of inputs and an output, guess will return any functions that match string representations
  [define [guess-str input output]
    [guess-with-test input output [λ [a b] [equal? [format "~s" a] [format "~s" b]]]]]
  
  
  ;Examples
  
  ; (guess input output)
  
  ; The "input" must always be a list, the search will (apply input), and then compare the output
  
  ; (guess-str input output)
  
  ; Same as (guess ...), but it stringifies the output and example output before comparing them.  Useful for comparing some complex data structures, where it is easier to compare their writting representations.
  
  [guess '["el" "hello"] #t]
  
  
  
  [guess '[1] 1.0]
  
  (define-struct posn (x y [z #:auto]) )
  [guess [list [make-posn 1 '[a b c]]] 1]
  
  
  [guess '[1 1] 2]
  [guess '[#\a] "a"]
  [guess '[1 #"asdf" ] #"s"]
  [guess '[[ 0 1 2]] 2]
  [guess '[2 [ 0 1 2]] 0]
  [guess '[ ["a" "b"] ","] "a,b"]
  [guess-str '[ 3 ] '[ 0 1 2]]
  [guess '["My name is ~a" "John"] "My name is John"]
  