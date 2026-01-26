use HTTP::Daemon;
use HTTP::Status;

my $d = new HTTP::Daemon;
print "Please contact me at: <URL:", $d->url, ">\n";
while (my $c = $d->accept) {
        my $r = $c->get_request;
        my $path = $r->url->path ;
        $path =~ s!^/!!g;
            print "Sending $path\n";
            $c->send_file_response($path);
 
        $c->close;
        undef($c);
}
