@echo off
cd /d "%~dp0"
chcp 65001 >nul
title YouTube LinuxLina
color 0A

echo ========================================================
echo   YouTube LinuxLina (Ultra version 2025)            
echo ========================================================
echo.

set BUFFER_SIZE=4096
set WINDOW_SIZE=1048576
set TTL_VALUE=12
set FRAGMENT_SIZE=3
set TIMEOUT_MS=3000
set REPEATS=10
set AUTO_TTL=4

echo Stopping previous processes... 
taskkill /F /IM winws.exe >nul 2>&1
timeout /t 1 >nul

echo Starting DNS encryption...
start "DNS YouTube" /min "%~dp0bin\winws.exe" --dns-over-https=https://cloudflare-dns.com/dns-query --dns-fake-ip=1.1.1.1 --dns-fake-port=53 --dns-intercept-list="%~dp0list-youtube.txt" --dns-timeout=1500 --dns-persistent-conn --dns-debug-level=1 --retry-count=5

echo Starting main bypass...
start "Main YouTube" /min "%~dp0bin\winws.exe" --wf-tcp=80,443 --wf-udp=443 --filter-udp=443 --hostlist="%~dp0list-youtube.txt" --dpi-desync=fake --dpi-desync-repeats=%REPEATS% --dpi-desync-fake-quic="%~dp0bin\quic_initial_www_google_com.bin" --dpi-desync-ttl=%TTL_VALUE% --new --filter-tcp=80 --hostlist="%~dp0list-youtube.txt" --dpi-desync=fake,split2 --dpi-desync-autottl=%AUTO_TTL% --dpi-desync-fooling=md5sig --new --filter-tcp=443 --hostlist="%~dp0list-youtube.txt" --dpi-desync=fake,split2 --dpi-desync-autottl=%AUTO_TTL% --dpi-desync-repeats=%REPEATS% --dpi-desync-fooling=badseq --dpi-desync-fake-tls="%~dp0bin\tls_clienthello_www_google_com.bin"

echo Starting Shorts optimization...
start "Shorts YouTube" /min "%~dp0bin\winws.exe" --wf-tcp=80,443 --wf-udp=443 --filter-udp=443 --hostlist="%~dp0list-youtube.txt" --dpi-desync=fake --dpi-desync-repeats=14 --dpi-desync-fake-quic="%~dp0bin\quic_initial_www_google_com.bin" --dpi-desync-ttl=18 --host-match="^r[0-9].*\.googlevideo\.com|ytimg|i[0-9]\.ytimg\.com|yt3\.ggpht\.com" --dport=443 --new --filter-tcp=443 --hostlist="%~dp0list-youtube.txt" --dpi-desync=split2,fake --dpi-desync-split-pos=2 --dpi-desync-ttl=14 --dpi-desync-repeats=12 --dpi-desync-fooling=badseq,md5sig --dpi-desync-fake-tls="%~dp0bin\tls_clienthello_www_google_com.bin" --host-match="^r[0-9].*\.googlevideo\.com|ytimg|i[0-9]\.ytimg\.com|yt3\.ggpht\.com"

echo Starting anti-buffering solution...
start "Video YouTube" /min "%~dp0bin\winws.exe" --wf-tcp=443 --filter-tcp=443 --hostlist="%~dp0list-youtube.txt" --host-match="^r[0-9].*\.googlevideo\.com" --dport=443 --dpi-desync=fake,split2 --dpi-desync-split-pos=3 --dpi-desync-ttl=12 --dpi-desync-repeats=8 --dpi-desync-fooling=badseq --buffer-size=%BUFFER_SIZE% --window-size=%WINDOW_SIZE% --timeout=%TIMEOUT_MS%

cls
echo.
echo +------------------------------------------------------------------+
echo ^|  YouTube bypass started successfully                              ^|
echo ^|                                                                  ^|
echo ^|  All components are now running in background mode               ^|
echo ^|                                                                  ^|
echo ^|  You can close this window, the bypass will continue running     ^|
echo +------------------------------------------------------------------+

echo.
echo Press any key to close this window...
pause > nul