#!/bin/bash

echo "=========================================="
echo "World Stuff VR Server"
echo "=========================================="
echo ""
echo "Starting HTTPS server on port 8443..."
echo ""

# Get local IP address
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
else
    # Linux
    LOCAL_IP=$(hostname -I | awk '{print $1}')
fi

echo "Your local IP address is: $LOCAL_IP"
echo ""
echo "On your Meta Quest headset, open the browser and go to:"
echo ""
echo "    https://$LOCAL_IP:8443/"
echo ""
echo "You will need to accept the security warning for the self-signed certificate."
echo ""
echo "=========================================="
echo ""

node server.js
