#!/bin/bash
# Diagnostic script for Apache UserDir issues after SSL setup

echo "=== Apache UserDir Diagnostic ==="
echo "Date: $(date)"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo "Please run as root (sudo)"
   exit 1
fi

echo "1. Checking Apache modules..."
echo "--------------------------------"
apache2ctl -M | grep -E "(userdir|ssl|rewrite)" || a2enmod userdir

echo ""
echo "2. Checking UserDir configuration..."
echo "--------------------------------"
if [ -f /etc/apache2/mods-enabled/userdir.conf ]; then
    echo "UserDir module is enabled"
    cat /etc/apache2/mods-enabled/userdir.conf
else
    echo "ERROR: UserDir module not enabled!"
    echo "Run: sudo a2enmod userdir"
fi

echo ""
echo "3. Checking SSL configuration..."
echo "--------------------------------"
if [ -f /etc/apache2/sites-enabled/default-ssl.conf ]; then
    echo "SSL site enabled"
    grep -E "(DocumentRoot|UserDir|Directory)" /etc/apache2/sites-enabled/default-ssl.conf
else
    echo "SSL site not found in sites-enabled"
fi

echo ""
echo "4. Checking main site configuration..."
echo "--------------------------------"
for conf in /etc/apache2/sites-enabled/*.conf; do
    echo "File: $conf"
    grep -E "(UserDir|public_html|Directory.*home)" "$conf" || echo "No UserDir directives found"
    echo ""
done

echo ""
echo "5. Checking Apache error logs..."
echo "--------------------------------"
tail -20 /var/log/apache2/error.log | grep -E "(userdir|public_html|~)"

echo ""
echo "6. Testing Apache configuration..."
echo "--------------------------------"
apache2ctl configtest

echo ""
echo "7. Checking permissions on a sample home directory..."
echo "--------------------------------"
# Get first regular user
TESTUSER=$(getent passwd | awk -F: '$3 >= 1000 && $3 < 65534 {print $1}' | head -1)
if [ -n "$TESTUSER" ]; then
    echo "Checking user: $TESTUSER"
    ls -la /home/$TESTUSER/ | grep public_html
    ls -la /home/$TESTUSER/public_html/ 2>/dev/null | head -5
else
    echo "No regular users found"
fi

echo ""
echo "8. Current Apache version..."
echo "--------------------------------"
apache2 -v

echo ""
echo "9. Active Apache ports..."
echo "--------------------------------"
netstat -tlnp | grep apache2

echo ""
echo "=== Common Issues and Solutions ==="
echo ""
echo "1. If UserDir module is not enabled:"
echo "   sudo a2enmod userdir"
echo "   sudo systemctl restart apache2"
echo ""
echo "2. If permissions are wrong:"
echo "   chmod 711 /home/USERNAME"
echo "   chmod 755 /home/USERNAME/public_html"
echo ""
echo "3. If SSL is intercepting UserDir:"
echo "   Check VirtualHost configuration"
echo ""
