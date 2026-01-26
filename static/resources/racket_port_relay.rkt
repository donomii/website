#lang racket

; Port Relay
;
; Listen on a port, and relay all connections to a different port
;
; Optional: save all the data that is relayed to log files.  
; Two files will be created per connection, a "server" and 
; "client" file, with a unique number for that connection.
;
; To save the traffic, set capture_traffic to #t, and set 
; log_dir to the directory you want to save the files to.


[define [debug text]
  [displayln text]
  #t]

[define capture_traffic #t]
[define log_dir "c:\\"]  ;You'll be wanting to change this

[define serial_num 1]
[define [get_num] [set! serial_num [add1 serial_num]] [sub1 serial_num]]
[define [make-buffer] (make-bytes [* 8 1024] (char->integer #\_)) ]


;We need our own port copy to handle flushing the output correctly
[define [my-copy-port buffer source target fileport]
  ;[debug [format "Reading source port ~a" source]]
  [let [[data [read-bytes-avail!  buffer source]]]
    [if  [not [eof-object? data]]
         [begin 
           ;[debug [format "Relaying ~a bytes from ~a to ~a ()" data source target ]]
           [write-bytes buffer target 0 data]
           [when fileport [write-bytes buffer fileport 0 data] [flush-output fileport]]
           [flush-output target]
           [my-copy-port buffer source target fileport]]
         [begin
           [debug "Port closed!"]
           [close-input-port source]
           [close-output-port  target]
           [when fileport [close-output-port fileport]]]]]]

;Start the relay threads for a incoming connection
[define [relay filename server-readp server-writep client-readp client-writep]
  [list [thread [thunk [with-handlers ([[thunk* #t] [lambda [err] [displayln [format "Thread closed: ~a" err] ]#f]]) 
                         [my-copy-port 
                          [make-buffer] 
                          server-readp 
                          client-writep 
                          [if filename 
                              [begin [debug [format "Writing to file ~a" [format "~a_server.http" filename]]][open-output-file [format "~a_server.http" filename] #:exists 'truncate]]
                              #f] ]]]]
        [thread [thunk (with-handlers ([[thunk* #t] [thunk* #f]]) [my-copy-port 
                                                                   [make-buffer] 
                                                                   client-readp 
                                                                   server-writep 
                                                                   [if filename 
                                                                       [open-output-file [format "~a_client.http" filename] #:exists 'truncate]
                                                                       #f] ])]]]
  
  ]


;Monitor a listener.  When a connection is opened, start the relay threads and then return to listening for connections
[define listenloop [lambda [local_port remote_ip remote_port listener] 
                     [let-values [[[client-readp client-writep][tcp-accept listener]]]
                       [let-values [[[server-readp server-writep] (tcp-connect	 	remote_ip remote_port)]]
                         [displayln [format "Relaying connection localhost:~a -> ~a:~a" local_port remote_ip remote_port]]
                         [relay [if capture_traffic [format "~aconnection_~a" log_dir [get_num]] #f] server-readp server-writep client-readp client-writep]
                         [listenloop local_port remote_ip remote_port listener]
                         ]]]]

;Listen on a local port.  Relay connections to the remote IP address and remote port
[define [relay-port local_port remote_ip remote_port ]
  [listenloop local_port remote_ip remote_port  (tcp-listen local_port 1 #t #f)]
  [debug "Finished listening"]]

; Start a listener on port 81 that will relay connections to localhost 8080
[relay-port 81 "localhost" 1313]